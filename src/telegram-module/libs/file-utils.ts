import * as fs from 'fs/promises';
import * as path from 'path';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * Создает папку, если она не существует
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Скачивает файл по URL и сохраняет его в локальную папку
 */
export async function downloadAndSaveFile(
  httpService: HttpService,
  fileUrl: string,
  localDir: string,
  fileName?: string,
): Promise<string> {
  try {
    // Создаем папку, если её нет
    await ensureDirectoryExists(localDir);

    // Скачиваем файл
    const response = await firstValueFrom(
      httpService.get(fileUrl, {
        responseType: 'arraybuffer',
      }),
    );

    // Определяем имя файла
    const urlFileName = fileName || path.basename(new URL(fileUrl).pathname) || 'image.jpg';
    const filePath = path.join(localDir, urlFileName);

    // Сохраняем файл
    await fs.writeFile(filePath, Buffer.from(response.data));

    return filePath;
  } catch (error) {
    throw new Error(`Failed to download and save file: ${error.message}`);
  }
}

/**
 * Читает файл и преобразует его в base64
 */
export async function fileToBase64(filePath: string): Promise<string> {
  try {
    const fileBuffer = await fs.readFile(filePath);
    return fileBuffer.toString('base64');
  } catch (error) {
    throw new Error(`Failed to read file and convert to base64: ${error.message}`);
  }
}

/**
 * Определяет MIME type по расширению файла
 */
export function getMimeTypeFromExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
  };

  return mimeTypes[ext] || 'image/jpeg';
}

/**
 * Скачивает файл, сохраняет его локально и возвращает base64 с data URL
 */
export async function downloadFileAsBase64(
  httpService: HttpService,
  fileUrl: string,
  localDir: string,
  fileName?: string,
): Promise<{ filePath: string; base64: string; dataUrl: string }> {
  // Скачиваем и сохраняем файл
  const filePath = await downloadAndSaveFile(httpService, fileUrl, localDir, fileName);

  // Преобразуем в base64
  const base64 = await fileToBase64(filePath);

  // Определяем MIME type
  const mimeType = getMimeTypeFromExtension(filePath);

  // Создаем data URL
  const dataUrl = `data:${mimeType};base64,${base64}`;

  return {
    filePath,
    base64,
    dataUrl,
  };
}

