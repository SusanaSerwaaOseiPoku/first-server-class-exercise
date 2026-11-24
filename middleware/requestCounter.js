export default function requestCounter(request, _response, next) {
  const stats = request.app.locals.requestStats;
  stats.total += 1;
  stats.byMethod[request.method] = (stats.byMethod[request.method] ?? 0) + 1;
  next();
}
