// 이미 설정된 환경 변수는 덮어쓰지 않는다.
export function loadEnvFile(path: string = '.env'): boolean {
  try {
    process.loadEnvFile(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}
