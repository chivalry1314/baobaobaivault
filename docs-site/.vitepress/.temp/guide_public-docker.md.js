import { ssrRenderAttrs } from "vue/server-renderer";
import { useSSRContext } from "vue";
import { _ as _export_sfc } from "./plugin-vue_export-helper.1tPrXgE0.js";
const __pageData = JSON.parse('{"title":"Public Docker Deployment","description":"","frontmatter":{},"headers":[],"relativePath":"guide/public-docker.md","filePath":"guide/public-docker.md","lastUpdated":1781673040000}');
const _sfc_main = { name: "guide/public-docker.md" };
function _sfc_ssrRender(_ctx, _push, _parent, _attrs, $props, $setup, $data, $options) {
  _push(`<div${ssrRenderAttrs(_attrs)}><h1 id="public-docker-deployment" tabindex="-1">Public Docker Deployment <a class="header-anchor" href="#public-docker-deployment" aria-label="Permalink to &quot;Public Docker Deployment&quot;">​</a></h1><p>Use the full deployment guides:</p><ul><li><a href="./../README.zh-CN">中文部署文档</a></li><li><a href="./../README.en">English Deployment Guide</a></li></ul><p>Core deployment files:</p><ul><li><a href="../docker-compose.public.yml">docker-compose.public.yml</a></li><li><a href="./../.env.public.example">.env.public.example</a></li><li><a href="./backend/config.public.example.yaml">deploy/backend/config.public.example.yaml</a></li><li><a href="./nginx/default.public.conf">deploy/nginx/default.public.conf</a></li><li><a href="./../scripts/init-production.sh">scripts/init-production.sh</a></li><li><a href="./../scripts/create-admin.sh">scripts/create-admin.sh</a></li></ul><p>Email verification docs:</p><ul><li><a href="./../backend/config/SHARE_AUTH_EMAIL_DEPLOY">English Guide</a></li><li><a href="./../backend/config/SHARE_AUTH_EMAIL_DEPLOY_ZH">中文说明</a></li></ul></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("guide/public-docker.md");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const publicDocker = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);
export {
  __pageData,
  publicDocker as default
};
