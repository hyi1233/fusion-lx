package cn.toside.music.mobile.folia;

import android.content.res.AssetManager;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Folia WebView 静态资源本地服务器。
 *
 * <p>Folia 的 WebView 页面（fusion-music 的 dist-webview/ 产物）是 ES module 脚本，
 * 其中的 monet 模式还会用 module worker 加载背景管线。Android Chromium 在
 * {@code file://} 下会拒绝加载 module script 与 worker（opaque origin），
 * 所以这里在应用进程内起一个只监听 127.0.0.1 的极简 HTTP 服务器，
 * 把 assets/folia 下的文件按普通同源资源提供出去。
 *
 * <p>只服务打包进 assets 的静态文件，不对外暴露，也没有任何写接口。
 */
public class FoliaAssetServerModule extends ReactContextBaseJavaModule {
  private static final String TAG = "FoliaAssetServer";
  private static final String ASSET_DIR = "folia";
  /** 页面入口（fusion-music 的 dist-webview 产物文件名）。 */
  private static final String ENTRY_FILE = "folia-webview.html";

  private final ReactApplicationContext reactContext;
  private ServerSocket serverSocket;
  private Thread acceptThread;
  private volatile boolean running = false;

  public FoliaAssetServerModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @Override
  public String getName() {
    return "FoliaAssetServer";
  }

  /**
   * 启动服务器并返回页面入口 URL。重复调用会复用同一个实例。
   *
   */
  @ReactMethod
  public void start(Promise promise) {
    try {
      if (!running) {
        serverSocket = new ServerSocket(0, 8, InetAddress.getByName("127.0.0.1"));
        running = true;
        acceptThread = new Thread(new Runnable() {
          @Override
          public void run() {
            acceptLoop();
          }
        }, "folia-asset-server");
        acceptThread.setDaemon(true);
        acceptThread.start();
      }
      String url = "http://127.0.0.1:" + serverSocket.getLocalPort() + "/" + ENTRY_FILE;
      promise.resolve(url);
    } catch (Exception e) {
      Log.e(TAG, "failed to start asset server", e);
      promise.reject("folia_asset_server_start_failed", e.getMessage(), e);
    }
  }

  @ReactMethod
  public void stop(Promise promise) {
    stopServer();
    promise.resolve(true);
  }

  private void stopServer() {
    running = false;
    try {
      if (serverSocket != null) serverSocket.close();
    } catch (IOException ignored) {
      // ignore
    }
    serverSocket = null;
  }

  @Override
  public void invalidate() {
    stopServer();
    super.invalidate();
  }

  private void acceptLoop() {
    while (running) {
      Socket socket = null;
      try {
        socket = serverSocket.accept();
        // 每个连接单独一个线程：Chromium 会预连接（连上但不发请求），
        // 串行处理会让这些空连接阻塞住整个 accept 循环。
        serveInBackground(socket);
        socket = null; // 交给后台线程负责关闭
      } catch (IOException e) {
        if (running) Log.w(TAG, "asset server accept error", e);
      } finally {
        if (socket != null) {
          try {
            socket.close();
          } catch (IOException ignored) {
            // ignore
          }
        }
      }
    }
  }

  private void serveInBackground(final Socket socket) {
    Thread worker = new Thread(new Runnable() {
      @Override
      public void run() {
        try {
          handle(socket);
        } catch (IOException e) {
          // ignore
        } finally {
          try {
            socket.close();
          } catch (IOException ignored) {
            // ignore
          }
        }
      }
    }, "folia-asset-conn");
    worker.setDaemon(true);
    worker.start();
  }

  private void handle(Socket socket) throws IOException {
    socket.setSoTimeout(15000);
    InputStream in = socket.getInputStream();
    OutputStream rawOut = socket.getOutputStream();

    String requestLine = readLine(in);
    if (requestLine == null || requestLine.isEmpty()) return;
    String[] parts = requestLine.split(" ");
    if (parts.length < 2) return;
    String method = parts[0].toUpperCase(Locale.ROOT);
    String rawPath = parts[1];

    // 读完请求头（Content-Length 等），否则客户端可能一直等响应
    String header;
    while ((header = readLine(in)) != null && !header.isEmpty()) {
      // ignore
    }

    String path = rawPath;
    int q = path.indexOf('?');
    if (q >= 0) path = path.substring(0, q);
    path = normalize(path);

    if (path == null) {
      sendError(rawOut, 400, "Bad Request");
      return;
    }

    byte[] body = readAsset(path);
    if (body == null) {
      sendError(rawOut, 404, "Not Found");
      return;
    }

    BufferedOutputStream out = new BufferedOutputStream(rawOut);
    StringBuilder head = new StringBuilder();
    head.append("HTTP/1.1 200 OK\r\n");
    head.append("Content-Type: ").append(contentType(path)).append("\r\n");
    head.append("Content-Length: ").append(body.length).append("\r\n");
    head.append("Cache-Control: no-cache\r\n");
    head.append("Access-Control-Allow-Origin: *\r\n");
    head.append("Connection: close\r\n\r\n");
    out.write(head.toString().getBytes("UTF-8"));
    if (!"HEAD".equals(method)) out.write(body);
    out.flush();
  }

  private byte[] readAsset(String path) {
    AssetManager assets = reactContext.getAssets();
    InputStream stream = null;
    try {
      stream = assets.open(ASSET_DIR + "/" + path);
      ByteArrayOutputStream buffer = new ByteArrayOutputStream();
      byte[] chunk = new byte[16 * 1024];
      int read;
      while ((read = stream.read(chunk)) > 0) buffer.write(chunk, 0, read);
      return buffer.toByteArray();
    } catch (IOException e) {
      return null;
    } finally {
      if (stream != null) {
        try {
          stream.close();
        } catch (IOException ignored) {
          // ignore
        }
      }
    }
  }

  /** 归一化路径；越界或非法路径返回 null。 */
  private static String normalize(String rawPath) {
    String path = rawPath;
    if (path.startsWith("/")) path = path.substring(1);
    if (path.isEmpty()) path = ENTRY_FILE;
    if (path.contains("..") || path.contains("\\")) return null;
    if (path.endsWith("/")) path = path + ENTRY_FILE;
    return path;
  }

  private static String readLine(InputStream in) throws IOException {
    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
    int c;
    while ((c = in.read()) != -1) {
      if (c == '\n') break;
      if (c != '\r') buffer.write(c);
    }
    if (c == -1 && buffer.size() == 0) return null;
    return buffer.toString("UTF-8");
  }

  private static void sendError(OutputStream out, int code, String message) throws IOException {
    byte[] body = message.getBytes("UTF-8");
    String head = "HTTP/1.1 " + code + " " + message + "\r\n"
        + "Content-Type: text/plain; charset=utf-8\r\n"
        + "Content-Length: " + body.length + "\r\n"
        + "Connection: close\r\n\r\n";
    out.write(head.getBytes("UTF-8"));
    out.write(body);
    out.flush();
  }

  private static final Map<String, String> CONTENT_TYPES = new HashMap<>();
  static {
    CONTENT_TYPES.put("html", "text/html; charset=utf-8");
    CONTENT_TYPES.put("js", "text/javascript; charset=utf-8");
    CONTENT_TYPES.put("mjs", "text/javascript; charset=utf-8");
    CONTENT_TYPES.put("css", "text/css; charset=utf-8");
    CONTENT_TYPES.put("json", "application/json; charset=utf-8");
    CONTENT_TYPES.put("svg", "image/svg+xml");
    CONTENT_TYPES.put("png", "image/png");
    CONTENT_TYPES.put("jpg", "image/jpeg");
    CONTENT_TYPES.put("jpeg", "image/jpeg");
    CONTENT_TYPES.put("gif", "image/gif");
    CONTENT_TYPES.put("webp", "image/webp");
    CONTENT_TYPES.put("ico", "image/x-icon");
    CONTENT_TYPES.put("woff", "font/woff");
    CONTENT_TYPES.put("woff2", "font/woff2");
    CONTENT_TYPES.put("ttf", "font/ttf");
    CONTENT_TYPES.put("otf", "font/otf");
    CONTENT_TYPES.put("wasm", "application/wasm");
    CONTENT_TYPES.put("map", "application/json; charset=utf-8");
    CONTENT_TYPES.put("txt", "text/plain; charset=utf-8");
  }

  private static String contentType(String path) {
    int dot = path.lastIndexOf('.');
    if (dot < 0) return "application/octet-stream";
    String ext = path.substring(dot + 1).toLowerCase(Locale.ROOT);
    String type = CONTENT_TYPES.get(ext);
    return type != null ? type : "application/octet-stream";
  }
}
