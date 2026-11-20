import type { MetadataRoute } from 'next';
import { site } from '@/data/site';
import { DIM_ORDER } from '@/lib/model';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['/', '/ledger', '/shape', '/sources', ...DIM_ORDER.map((d) => `/dimension/${d}`)];
  return paths.map((path) => ({
    url: `${site.url}${path === '/' ? '/' : path}`,
    lastModified: new Date(),
    changeFrequency: path === '/' ? 'daily' : 'monthly',
    priority: path === '/' ? 1 : 0.7,
  }));
}
