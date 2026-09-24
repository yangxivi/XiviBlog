/** 备份文件的格式定义（服务端与后台页面共用） */

export const BACKUP_VERSION = 1;

export type BackupPost = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image: string;
  tag: string;
  status: string;
  pinned: number;
  publish_at: string;
  created_at: string;
  updated_at: string;
};

export type BackupFile = {
  version: number;
  site: string;
  exportedAt: string;
  counts: { posts: number };
  settings: unknown;
  posts: BackupPost[];
};
