/**
 * 仅供 Node 内置测试运行器使用：把项目中的无扩展名相对导入解析到 .ts。
 * Vite 生产构建仍使用原有配置，不受此加载器影响。
 */
export async function resolve(specifier, context, nextResolve) {
  const isRelative = specifier.startsWith(".") || specifier.startsWith("/");
  const hasExtension = /\.[a-z0-9]+$/i.test(specifier);

  if (isRelative && !hasExtension) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch (error) {
      if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
      return nextResolve(`${specifier}/index.ts`, context);
    }
  }

  return nextResolve(specifier, context);
}
