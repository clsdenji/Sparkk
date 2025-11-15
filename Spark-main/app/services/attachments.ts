// Attachment picking and upload helpers for Expo + Supabase
// - Pick documents/images using expo-document-picker / expo-image-picker
// - Upload to Supabase Storage bucket and return public URLs

import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode as base64Decode } from 'base64-arraybuffer';
import type { SupabaseClient } from '@supabase/supabase-js';

export type Attachment = {
  uri: string;
  name?: string;
  mimeType?: string;
};

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'application/pdf']);

// Pick one image from gallery
export async function pickImage(): Promise<Attachment | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
    base64: false,
  });
  if (res.canceled) return null;
  const asset = res.assets?.[0];
  if (!asset) return null;
  const name = asset.fileName || asset.uri.split('/').pop() || 'image.jpg';
  const mimeType = inferMimeTypeFromName(name);
  if (!isAllowedAttachmentType(name, mimeType)) return null;
  return { uri: asset.uri, name, mimeType };
}

// Pick a document (pdf or image)
export async function pickDocument(): Promise<Attachment | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled) return null;
  const file = res.assets?.[0];
  if (!file) return null;
  const mimeType = file.mimeType || inferMimeTypeFromName(file.name);
  if (!isAllowedAttachmentType(file.name, mimeType)) return null;
  return { uri: file.uri, name: file.name, mimeType };
}

// Upload attachments to Supabase Storage and return array of public paths/URLs
export async function uploadAttachments(
  supabase: SupabaseClient,
  bucket: string,
  items: Attachment[],
  opts?: { folder?: string; makePublic?: boolean }
): Promise<{ path: string; publicUrl?: string }[]> {
  const out: { path: string; publicUrl?: string }[] = [];
  const folder = (opts?.folder || new Date().toISOString().slice(0, 10)).replace(/[^a-zA-Z0-9/_-]/g, '_');
  for (const it of items) {
    try {
      if (!isAllowedAttachmentType(it.name || '', it.mimeType)) {
        // skip non-allowed types
        continue;
      }
      const filenameSafe = (it.name || it.uri.split('/').pop() || 'file')
        .replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${folder}/${Date.now()}-${filenameSafe}`;
      // Read file from local URI as base64 and convert to Uint8Array
  const base64 = await FileSystem.readAsStringAsync(it.uri, { encoding: 'base64' as any });
      const buffer = base64Decode(base64); // ArrayBuffer
      const contentType = it.mimeType || inferMimeTypeFromName(filenameSafe);
      // Upload (upsert true so re-uploads replace)
      const { error } = await supabase.storage
        .from(bucket)
        .upload(storagePath, buffer as any, { contentType, upsert: true });
      if (error) throw error;
      let publicUrl: string | undefined;
      if (opts?.makePublic) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
        publicUrl = data.publicUrl;
      }
      out.push({ path: storagePath, publicUrl });
    } catch (e) {
      // continue on error for individual files
      out.push({ path: '', publicUrl: undefined });
    }
  }
  return out;
}

function inferMimeTypeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

export function isAllowedAttachmentType(name?: string, mimeType?: string): boolean {
  const mt = (mimeType || (name ? inferMimeTypeFromName(name) : '')).toLowerCase();
  if (ALLOWED_MIME.has(mt)) return true;
  // If mime is unknown, fallback by extension
  const lower = (name || '').toLowerCase();
  return lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.pdf');
}
