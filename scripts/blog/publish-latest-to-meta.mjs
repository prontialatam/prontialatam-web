#!/usr/bin/env node

import fs from "node:fs";
import { execFileSync } from "node:child_process";

const SITE_URL = stripTrailingSlash(process.env.SITE_URL || "https://www.prontialatam.com");
const META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v25.0";
const META_PAGE_ID = process.env.META_PAGE_ID || "";
const META_PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN || "";
const META_INSTAGRAM_USER_ID = process.env.META_INSTAGRAM_USER_ID || "";
const DRY_RUN = isTruthy(process.env.BLOG_META_DRY_RUN);
const BEFORE_SHA = normalizeBeforeSha(process.env.GITHUB_EVENT_BEFORE || process.env.BLOG_META_BEFORE_SHA || "");
const DEFAULT_IMAGE_URL = process.env.META_SOCIAL_DEFAULT_IMAGE_URL || `${SITE_URL}/logo-prontia.jpg`;

async function main() {
  const currentHtml = fs.readFileSync("index.html", "utf8");
  const currentArticle = extractLatestArticle(currentHtml);

  if (!currentArticle) {
    throw new Error("No pude encontrar artículos del blog en index.html.");
  }

  const previousArticle = readPreviousArticle(BEFORE_SHA);
  if (previousArticle && previousArticle.id === currentArticle.id) {
    console.log(`No hay artículo nuevo. El artículo más reciente sigue siendo #${currentArticle.id}.`);
    return;
  }

  const publication = {
    article: currentArticle,
    dryRun: DRY_RUN,
    previousArticleId: previousArticle ? previousArticle.id : null,
    facebook: null,
    instagram: null
  };

  if (!META_PAGE_ID || !META_PAGE_ACCESS_TOKEN) {
    throw new Error(
      "Faltan META_PAGE_ID o META_PAGE_ACCESS_TOKEN. Configura los secretos de GitHub antes de activar la publicación automática."
    );
  }

  if (DRY_RUN) {
    publication.facebook = {
      endpoint: `/${META_PAGE_ID}/feed`,
      message: buildFacebookMessage(currentArticle),
      link: currentArticle.url
    };
    publication.instagram = META_INSTAGRAM_USER_ID
      ? {
          endpoint: `/${META_INSTAGRAM_USER_ID}/media -> /${META_INSTAGRAM_USER_ID}/media_publish`,
          caption: buildInstagramCaption(currentArticle),
          imageUrl: currentArticle.imageUrl
        }
      : {
          skipped: true,
          reason: "META_INSTAGRAM_USER_ID no configurado"
        };

    console.log(JSON.stringify(publication, null, 2));
    return;
  }

  publication.facebook = await publishFacebookPost(currentArticle);

  publication.instagram = META_INSTAGRAM_USER_ID
    ? await publishInstagramPost(currentArticle)
    : {
        skipped: true,
        reason: "META_INSTAGRAM_USER_ID no configurado"
      };

  console.log(JSON.stringify(publication, null, 2));
}

function extractLatestArticle(html) {
  const articleIds = [...html.matchAll(/<div class="blog-article" id="blogArticle(\d+)">/g)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);

  if (!articleIds.length) return null;

  const latestId = Math.max(...articleIds);
  const shareId = `blogArticle${latestId}`;
  const titleMatch = html.match(new RegExp(`<div class="blog-article" id="${shareId}">[\\s\\S]*?<h1 class="article-title">([\\s\\S]*?)<\\/h1>`));
  const introMatch = html.match(new RegExp(`<div class="blog-article" id="${shareId}">[\\s\\S]*?<p class="article-intro">([\\s\\S]*?)<\\/p>`));
  const heroStyleMatch = html.match(
    new RegExp(`<div class="blog-hero" style="([^"]*?)">[\\s\\S]*?toggleArticle\\('${shareId}'\\)`, "m")
  );

  if (!titleMatch || !introMatch) {
    throw new Error(`No pude extraer el título o la introducción del artículo ${shareId}.`);
  }

  const relativeImagePath = extractBackgroundImagePath(heroStyleMatch ? heroStyleMatch[1] : "");

  return {
    id: latestId,
    shareId,
    title: decodeHtml(stripTags(titleMatch[1]).trim()),
    intro: decodeHtml(stripTags(introMatch[1]).trim()),
    url: `${SITE_URL}/#${shareId}`,
    imageUrl: relativeImagePath ? buildAbsoluteUrl(relativeImagePath) : DEFAULT_IMAGE_URL
  };
}

function readPreviousArticle(beforeSha) {
  if (!beforeSha) return null;

  try {
    const previousHtml = execFileSync("git", ["show", `${beforeSha}:index.html`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return extractLatestArticle(previousHtml);
  } catch {
    return null;
  }
}

async function publishFacebookPost(article) {
  const response = await graphRequest(`/${META_PAGE_ID}/feed`, {
    message: buildFacebookMessage(article),
    link: article.url
  });

  return {
    id: response.id
  };
}

async function publishInstagramPost(article) {
  const container = await graphRequest(`/${META_INSTAGRAM_USER_ID}/media`, {
    image_url: article.imageUrl,
    caption: buildInstagramCaption(article)
  });

  await waitForInstagramContainer(container.id);

  const publication = await graphRequest(`/${META_INSTAGRAM_USER_ID}/media_publish`, {
    creation_id: container.id
  });

  return {
    creationId: container.id,
    id: publication.id,
    imageUrl: article.imageUrl
  };
}

async function waitForInstagramContainer(containerId) {
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const status = await graphRequest(`/${containerId}`, {
      fields: "status_code,status"
    }, "GET");

    if (status.status_code === "FINISHED") return;

    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new Error(`El contenedor de Instagram ${containerId} terminó en estado ${status.status_code}.`);
    }

    await sleep(5000);
  }

  throw new Error(`Timeout esperando a que Instagram procesara el contenedor ${containerId}.`);
}

async function graphRequest(path, params, method = "POST") {
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}${path}`);
  const search = new URLSearchParams({
    ...params,
    access_token: META_PAGE_ACCESS_TOKEN
  });

  let response;
  if (method === "GET") {
    url.search = search.toString();
    response = await fetch(url, { method: "GET" });
  } else {
    response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: search.toString()
    });
  }

  const json = await response.json();
  if (!response.ok || json.error) {
    const details = json.error
      ? `${json.error.message} (${json.error.type || "MetaError"} ${json.error.code || ""})`.trim()
      : `HTTP ${response.status}`;
    throw new Error(`Meta Graph API error en ${path}: ${details}`);
  }

  return json;
}

function buildFacebookMessage(article) {
  return [
    article.title,
    "",
    truncate(article.intro, 240),
    "",
    `Lee el artículo completo: ${article.url}`,
    "",
    "#ProntIALatam #InteligenciaArtificial #Pymes #LATAM"
  ].join("\n");
}

function buildInstagramCaption(article) {
  return [
    article.title,
    "",
    truncate(article.intro, 220),
    "",
    `Artículo completo en nuestro blog: ${article.url}`,
    "",
    "#ProntIALatam #InteligenciaArtificial #Pymes #MarketingDigital #LATAM"
  ].join("\n");
}

function extractBackgroundImagePath(styleValue) {
  const match = styleValue.match(/url\('([^']+)'\)/);
  return match ? match[1] : "";
}

function buildAbsoluteUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${cleanPath}`;
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, "");
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function normalizeBeforeSha(value) {
  if (!value || /^0+$/.test(value)) return "";
  return value.trim();
}

function isTruthy(value) {
  return /^(1|true|yes)$/i.test(value || "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
