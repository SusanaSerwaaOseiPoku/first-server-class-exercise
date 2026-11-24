export default function logger(request, _response, next) {
  console.log(`${request.method} ${request.originalUrl}`);
  next();
}
