/* ==========================================================================
   cloud-config.js —— 云服务连接配置（唯一需要改动的地方）

   这几个值来自 WorkBuddy 云服务的 publicConfig（应用「知行手记」）
   applicationId : wbapp_s9Oi8ajo7m3YAMBvCtvR24
   resourceId    : wbcs_Y6LhaeVGdqbJZ1JcPVLMl4

   publishableKey 只是「哪个应用」的半公开标识，本身不含权限；真正的防线是
   服务端对请求来源 Origin 的精确匹配。所以它可以放进前端代码，但不要写进日志。

   ⚠️ 官方文档给的是 CDN 形式：
        <script src="//cdn.jsdelivr.net/npm/@tencent-ai/workbuddy-cloud-sdk@dev/lib/index.global.js">
      本机网络访问不了 jsDelivr，而本站从一开始就是「零外链」设计，所以改成把
      SDK 下载到本地：assets/vendor/workbuddy-cloud/index.global.js
      版本 0.1.3-dev.c090db7.202610050023，需要升级时替换该文件即可（npm pack 该包，
      取 lib/index.global.js）。
   ========================================================================== */
window.CLOUD_CONFIG = {
  endpoint:          'https://zhixing-notes-28282.app.workbuddy.host',
  publishableKey:    'wbpk_s9Oi8ajo7m3YAMBvCtvR24_J6S0btmPBAIFKSIjat8pl2etdggvQooY',
  oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',

  /* 表名，改表结构时同步这里 */
  tableComments: 'comments',
  tableAssets:   'post_assets',

  /* 展示参数 */
  commentLimit: 80,
  assetLimit:   60
};
