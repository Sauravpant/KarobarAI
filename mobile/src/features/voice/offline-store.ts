import { Directory, File, Paths } from 'expo-file-system';

export interface SavedRecording {
  uri: string;
  name: string;
  recordedAt: number;
  durationMillis: number;
}

function folder() {
  const dir = new Directory(Paths.document, 'offline-voice');
  dir.create({ idempotent: true, intermediates: true });
  return dir;
}

export function saveRecording(shopId: string, uri: string, durationMillis: number) {
  const source = new File(uri);
  const ext = source.extension || '.m4a';
  source.move(new File(folder(), `${shopId}_${Date.now()}_${Math.round(durationMillis)}${ext}`));
}

export function listRecordings(shopId: string): SavedRecording[] {
  return folder()
    .list()
    .flatMap((entry) => {
      if (!(entry instanceof File)) return [];
      const [owner, recordedAt, duration] = entry.name.replace(/\.[^.]+$/, '').split('_');
      if (owner !== shopId) return [];
      return [{ uri: entry.uri, name: entry.name, recordedAt: Number(recordedAt), durationMillis: Number(duration) || 0 }];
    })
    .sort((a, b) => a.recordedAt - b.recordedAt);
}


export function findRecording(name: string): SavedRecording | null {
  const file = new File(folder(), name);
  if (!file.exists) return null;
  const [, recordedAt, duration] = name.replace(/\.[^.]+$/, '').split('_');
  return { uri: file.uri, name, recordedAt: Number(recordedAt), durationMillis: Number(duration) || 0 };
}

export function deleteRecording(uri: string) {
  const file = new File(uri);
  if (file.exists) file.delete();
}
