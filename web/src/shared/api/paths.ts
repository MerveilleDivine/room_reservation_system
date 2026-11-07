export function withQuery(path: string, query?: URLSearchParams | string) {
  const value = query?.toString().replace(/^\?/, '');
  return value ? `${path}?${value}` : path;
}

/** Query ordering does not change which server-owned resource is requested. */
export function normalizePath(path: string) {
  const [pathname = '', search = ''] = path.split('?');
  const parameters = new URLSearchParams(search);
  parameters.sort();
  return withQuery(pathname, parameters);
}
