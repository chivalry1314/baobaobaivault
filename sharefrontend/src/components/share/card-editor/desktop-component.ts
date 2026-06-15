import {
  desktopComponentMetaDefaults,
  desktopComponentMetaLimits,
  type DesktopComponentMetadata,
} from "@/components/share/card-editor/constants";

export type DesktopComponentValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  parsed: DesktopComponentMetadata;
  html: string;
};

const widgetMetaNames: Array<keyof DesktopComponentMetadata> = [
  "name",
  "width",
  "height",
  "cornerRadius",
  "frosted",
  "shadow",
  "backgroundOpacity",
];

const metaNameToKey = (metaName: string): keyof DesktopComponentMetadata | null => {
  switch (metaName) {
    case "widget-name":
      return "name";
    case "widget-width":
      return "width";
    case "widget-height":
      return "height";
    case "widget-corner-radius":
      return "cornerRadius";
    case "widget-frosted":
      return "frosted";
    case "widget-shadow":
      return "shadow";
    case "widget-background-opacity":
      return "backgroundOpacity";
    default:
      return null;
  }
};

const keyToMetaName = (key: keyof DesktopComponentMetadata): string => {
  switch (key) {
    case "name":
      return "widget-name";
    case "width":
      return "widget-width";
    case "height":
      return "widget-height";
    case "cornerRadius":
      return "widget-corner-radius";
    case "frosted":
      return "widget-frosted";
    case "shadow":
      return "widget-shadow";
    case "backgroundOpacity":
      return "widget-background-opacity";
    default:
      return "";
  }
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const parseIntSafe = (value: string | undefined | null, fallback: number): number => {
  if (value === undefined || value === null) return fallback;
  const trimmed = value.trim();
  if (trimmed === "") return fallback;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isHtmlFile = (file: File): boolean => {
  const name = file.name.toLowerCase();
  if (name.endsWith(".html") || name.endsWith(".htm")) return true;
  const type = (file.type || "").toLowerCase();
  return type === "text/html" || type === "application/html";
};

const hasHtmlStructure = (html: string): boolean => {
  const lower = html.toLowerCase();
  return lower.includes("<html") || lower.includes("<body");
};

export function parseDesktopComponentHtml(html: string): DesktopComponentMetadata {
  const result: DesktopComponentMetadata = { ...desktopComponentMetaDefaults };

  if (typeof window === "undefined" || !html.trim()) {
    return result;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const metaTags = doc.querySelectorAll("meta");

    metaTags.forEach((meta) => {
      const name = (meta.getAttribute("name") || "").trim().toLowerCase();
      const content = meta.getAttribute("content") || "";
      const key = metaNameToKey(name);
      if (!key) return;

      switch (key) {
        case "name":
          if (content.trim()) {
            result.name = content.trim();
          }
          break;
        case "width":
          result.width = clamp(parseIntSafe(content, result.width), desktopComponentMetaLimits.width.min, desktopComponentMetaLimits.width.max);
          break;
        case "height":
          result.height = clamp(parseIntSafe(content, result.height), desktopComponentMetaLimits.height.min, desktopComponentMetaLimits.height.max);
          break;
        case "cornerRadius":
          result.cornerRadius = clamp(parseIntSafe(content, result.cornerRadius), desktopComponentMetaLimits.cornerRadius.min, desktopComponentMetaLimits.cornerRadius.max);
          break;
        case "frosted":
          result.frosted = clamp(parseIntSafe(content, result.frosted), desktopComponentMetaLimits.frosted.min, desktopComponentMetaLimits.frosted.max);
          break;
        case "shadow":
          result.shadow = clamp(parseIntSafe(content, result.shadow), desktopComponentMetaLimits.shadow.min, desktopComponentMetaLimits.shadow.max);
          break;
        case "backgroundOpacity":
          result.backgroundOpacity = clamp(parseIntSafe(content, result.backgroundOpacity), desktopComponentMetaLimits.backgroundOpacity.min, desktopComponentMetaLimits.backgroundOpacity.max);
          break;
      }
    });
  } catch {
    // 解析失败时返回默认值
  }

  return result;
}

export async function validateDesktopComponentFile(file: File | null): Promise<DesktopComponentValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!file) {
    errors.push("未选择文件");
    return {
      valid: false,
      errors,
      warnings,
      parsed: { ...desktopComponentMetaDefaults },
      html: "",
    };
  }

  if (!isHtmlFile(file)) {
    errors.push("桌面组件仅支持 .html 或 .htm 文件");
  }

  const html = await file.text();
  if (!html.trim()) {
    errors.push("HTML 文件内容为空");
  }

  if (!hasHtmlStructure(html)) {
    errors.push('HTML 文件缺少基础结构，需包含 <html> 或 <body> 标签');
  }

  const parsed = parseDesktopComponentHtml(html);

  if (!parsed.name.trim()) {
    warnings.push('缺少 <meta name="widget-name">，将使用卡片标题作为组件名称');
  }

  for (const key of widgetMetaNames) {
    if (key === "name") continue;
    const limits = desktopComponentMetaLimits[key];
    const value = parsed[key];
    if (value < limits.min || value > limits.max) {
      warnings.push(`<meta name="${keyToMetaName(key)}"> 值 ${value} 不在合法范围 ${limits.min}~${limits.max} 内，将使用默认值`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    parsed,
    html,
  };
}

export function buildCompliantDesktopComponentHtml(html: string, metadata: DesktopComponentMetadata): string {
  if (!html.trim()) {
    return "";
  }

  let doc: Document;

  if (typeof window !== "undefined") {
    try {
      const parser = new DOMParser();
      doc = parser.parseFromString(html, "text/html");
    } catch {
      doc = document.implementation.createHTMLDocument("");
      doc.body.innerHTML = html;
    }
  } else {
    return html;
  }

  let head = doc.querySelector("head");
  if (!head) {
    head = doc.createElement("head");
    const htmlElement = doc.documentElement || doc.createElement("html");
    const body = doc.body || doc.createElement("body");
    htmlElement.appendChild(head);
    htmlElement.appendChild(body);
    doc.appendChild(htmlElement);
  }

  const ensureCharsetMeta = () => {
    let charsetMeta = head.querySelector('meta[charset]');
    if (!charsetMeta) {
      charsetMeta = doc.createElement("meta");
      charsetMeta.setAttribute("charset", "UTF-8");
      head.insertBefore(charsetMeta, head.firstChild);
    }
  };

  ensureCharsetMeta();

  const setMeta = (name: string, content: string) => {
    let meta: HTMLMetaElement | null = null;
    const existing = head.querySelectorAll("meta");
    for (let i = 0; i < existing.length; i += 1) {
      const item = existing[i];
      if (item.getAttribute("name")?.toLowerCase() === name) {
        meta = item;
        break;
      }
    }
    if (!meta) {
      meta = doc.createElement("meta");
      meta.setAttribute("name", name);
      head.appendChild(meta);
    }
    meta.setAttribute("content", content);
  };

  setMeta("widget-name", metadata.name.trim() || "未命名组件");
  setMeta("widget-width", String(clamp(metadata.width, desktopComponentMetaLimits.width.min, desktopComponentMetaLimits.width.max)));
  setMeta("widget-height", String(clamp(metadata.height, desktopComponentMetaLimits.height.min, desktopComponentMetaLimits.height.max)));
  setMeta("widget-corner-radius", String(clamp(metadata.cornerRadius, desktopComponentMetaLimits.cornerRadius.min, desktopComponentMetaLimits.cornerRadius.max)));
  setMeta("widget-frosted", String(clamp(metadata.frosted, desktopComponentMetaLimits.frosted.min, desktopComponentMetaLimits.frosted.max)));
  setMeta("widget-shadow", String(clamp(metadata.shadow, desktopComponentMetaLimits.shadow.min, desktopComponentMetaLimits.shadow.max)));
  setMeta("widget-background-opacity", String(clamp(metadata.backgroundOpacity, desktopComponentMetaLimits.backgroundOpacity.min, desktopComponentMetaLimits.backgroundOpacity.max)));

  const serializer = new XMLSerializer();
  const serialized = serializer.serializeToString(doc);

  // XMLSerializer 会输出 XML 声明和 xmlns，移除这些以保持 HTML 风格
  return serialized
    .replace(/^\s*<\?xml[^?]*\?>\s*/i, "")
    .replace(/\sxmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/gi, "");
}

export function createCompliantDesktopComponentFile(originalFile: File, metadata: DesktopComponentMetadata): Promise<File> {
  return originalFile.text().then((html) => {
    const compliantHtml = buildCompliantDesktopComponentHtml(html, metadata);
    const fileName = originalFile.name.replace(/\.html?$/i, ".html");
    return new File([new Blob([compliantHtml], { type: "text/html" })], fileName, { type: "text/html" });
  });
}
