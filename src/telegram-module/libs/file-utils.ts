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
 * Сохраняет файл (Buffer/ArrayBuffer) в локальную папку
 */
export async function saveFile(
  fileData: Buffer | ArrayBuffer,
  localDir: string,
  fileName: string,
): Promise<string> {
  try {
    // Создаем папку, если её нет
    await ensureDirectoryExists(localDir);

    const filePath = path.join(localDir, fileName);

    // Сохраняем файл
    const buffer = fileData instanceof Buffer 
      ? fileData 
      : Buffer.from(new Uint8Array(fileData));
    await fs.writeFile(filePath, buffer);

    return filePath;
  } catch (error) {
    throw new Error(`Failed to save file: ${error.message}`);
  }
}

/**
 * Скачивает файл по URL и сохраняет его в локальную папку
 * @deprecated Используйте saveFile для сохранения уже скачанного файла
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
 * Удаляет файл по requestId из указанной папки
 */
export async function deleteFileByRequestId(
  requestId: string,
  localDir: string,
  fileExtension: string = '.jpg',
): Promise<void> {
  try {
    const fileName = `${requestId}${fileExtension}`;
    const filePath = path.join(localDir, fileName);
    
    await fs.unlink(filePath);
  } catch (error) {
    // Игнорируем ошибку, если файл не существует
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
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

