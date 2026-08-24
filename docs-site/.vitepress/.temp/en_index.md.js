import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"","description":"","frontmatter":{"layout":"home","hero":{"name":"Baobaobai Vault","text":"Documentation","tagline":"Deployment, configuration and operation guides","actions":[{"theme":"brand","text":"Get Started","link":"/en/guide/deploy"},{"theme":"alt","text":"Backend Config","link":"/en/backend/config"},{"theme":"alt","text":"简体中文","link":"/"}]},"features":[{"icon":"🚀","title":"Full Deployment Guide","details":"Deploy the production stack with Docker Compose and public container images.","link":"/en/guide/deploy"},{"icon":"✅","title":"Production Checklist","details":"Verify domain, HTTPS, database, admin account, email verification and more before launch.","link":"/en/guide/checklist"},{"icon":"⚙️","title":"Backend Configuration","details":"Complete config.yaml example, WebPush, email verification and OSS media storage.","link":"/en/backend/config"},{"icon":"📦","title":"Media Storage Workflow","details":"Storage config, namespaces, media storage switch and card upload verification.","link":"/en/guide/storage-workflow"},{"icon":"🔍","title":"Site Search","details":"Use the search box in the top-right corner to find deployment and configuration topics quickly."},{"icon":"🌐","title":"Bilingual","details":"Switch between English and 简体中文 from the language menu in the top-right corner."}]},"headers":[],"relativePath":"en/index.md","filePath":"en/index.md","lastUpdated":1781673040000}');
const _sfc_main = { name: "en/index.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("en/index.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const index = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  index as default
};
