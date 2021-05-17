import { createReadStream, stat } from "fs";
import { promisify } from "util";
import { resolve } from "path";
import koa from "koa";
import jwt from "koa-jwt";
import cors from "@koa/cors";

const app = new koa();

app.use(cors());

app.use(async ({ request, response }, next) => {
  if (
    !request.url.startsWith("/stream/video") &&
    !request.url.startsWith("/stream/audio")
  ) {
    response.redirect("http://localhost:5500");
    return;
  }

  return next();
});

app.use(jwt({
  secret: 'secret',
  algorithms: ['HS256', 'HS512'],
  getToken: ({request}) => request.query.token
}));

app.use(async ({ request, response }, next) => {
  if (request.url.startsWith("/stream/video")) {
    response.type = "mp4";
  } else if (request.url.startsWith("/stream/audio")) {
    response.type = "mp3";
  } else {
    return next();
  }

  const video = resolve('contents', 'video.mp4');
  const range = request.header.range;

  if (!range) {
    response.body = createReadStream(video);
    return next();
  }

  const parts = range.replace('bytes=', '').split('-');
  const mediaStat = await promisify(stat)(video);
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : mediaStat.size - 1;
  const chunksize = (end - start) + 1;

  response.set('Content-Range', `bytes ${start}-${end}/${mediaStat.size}`);
  response.set('Accept-Ranges', `bytes`);
  response.set('Content-Length', chunksize);

  response.status = 206;
  response.body = createReadStream(video, {start, end});
});

app.listen(4000);
