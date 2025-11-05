import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from 'sonner';
import App from "./App.tsx";
import "./index.css";

// 错误处理函数
function handleRenderError(error: Error) {
  console.error("React应用渲染失败:", error);
  
  // 显示加载失败信息
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = `
      <div class="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-4">
        <div class="text-red-500 text-6xl mb-4">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <h1 class="text-3xl font-bold mb-2">应用加载失败</h1>
        <p class="text-gray-600 dark:text-gray-400 mb-6 max-w-md text-center">
          无法初始化应用程序。请刷新页面或检查您的网络连接。
        </p>
        <button 
          onclick="location.reload()" 
          class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
        >
          <i class="fas fa-redo-alt"></i>
          重新加载
        </button>
      </div>
    `;
  }
}

// 确保DOM元素存在
const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("根元素未找到");
  // 创建一个根元素作为后备
  const fallbackRoot = document.createElement("div");
  fallbackRoot.id = "root";
  document.body.appendChild(fallbackRoot);
}

// 尝试渲染应用
try {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
        <Toaster />
      </BrowserRouter>
    </StrictMode>
  );
} catch (error) {
  handleRenderError(error instanceof Error ? error : new Error("未知错误"));
}
