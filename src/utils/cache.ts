import {mkdir} from 'fs/promises';
import {dirname} from 'node:path';
import {readFile, writeFile} from 'fs/promises';

async function readJsonFile<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (err) {
    if (err?.['code'] == 'ENOENT') {
      return undefined;
    }
    throw err;
  }
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), {recursive: true});
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export class Cache<T> {
  constructor(private readonly filePath: string) {}

  read(): Promise<T | undefined> {
    return readJsonFile<T>(this.filePath);
  }

  write(data: T): Promise<void> {
    return writeJsonFile(this.filePath, data);
  }
}
