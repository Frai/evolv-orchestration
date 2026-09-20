import "reflect-metadata";
import type { Request, Response } from "express";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import express from "express";
import { AppModule } from "../src/app.module";

let server: express.Express | undefined;

async function bootstrap(): Promise<express.Express> {
  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
  app.enableCors({
    origin: [process.env.WEB_ORIGIN, "http://localhost:3000"].filter(Boolean),
  });
  await app.init();
  return expressApp;
}

export default async function handler(req: Request, res: Response) {
  if (!server) server = await bootstrap();
  server(req, res);
}
