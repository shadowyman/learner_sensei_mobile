import { Alert, Share } from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';

import type { NativeFileAdapter } from './SaveLoadService';

const sanitize = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, '');

const ensureFileUri = (uri: string): string => {
  if (uri.startsWith('file://')) {
    return uri;
  }
  return `file://${uri}`;
};

export class IOSFileAdapter implements NativeFileAdapter {
  async saveFile(filename: string, content: string): Promise<void> {
    const sanitized = `${sanitize(filename)}.json`;
    const path = `${RNFS.DocumentDirectoryPath}/${sanitized}`;
    await RNFS.writeFile(path, content, 'utf8');
    try {
      await Share.share({ url: `file://${path}`, message: 'Sensei export ready' });
    } catch (shareError) {
      Alert.alert('Export saved', `Saved to ${path}`);
    }
  }

  async pickFile(): Promise<{ filename: string; content: string }> {
    const result = await DocumentPicker.pickSingle({
      type: [DocumentPicker.types.plainText, DocumentPicker.types.allFiles],
      copyTo: 'cachesDirectory'
    });
    const uri = ensureFileUri(result.fileCopyUri ?? result.uri);
    const localPath = uri.replace('file://', '');
    const content = await RNFS.readFile(localPath, 'utf8');
    return {
      filename: result.name ?? 'sensei_import.json',
      content
    };
  }

  buildFilename(): string {
    const iso = new Date().toISOString().replace(/[:.]/g, '-');
    return `sensei_progress_${iso}`;
  }
}
