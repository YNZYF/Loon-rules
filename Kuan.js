/*
  Kuan.js — 酷安正文过滤（配合 Kuan.plugin 使用）
  由 Surge 模块 Kuan.sgmodule（Yi-r8/Surge，2026-11-14 v7）的 6 条
  http-response-jq 规则逐条翻译而来：Loon 不支持 jq，改用 JS 实现相同逻辑。
  6 个接口：main/init、main/indexV8、page/dataList、
  account/loadConfig?key=my_page_card_config、feed/detail、feed/replyList。
  解析失败、结构不对时原样放回，绝不拦断正常内容。
*/
(function () {
  var url = $request.url;
  var body = $response.body;
  try {
    var obj = JSON.parse(body);
    if (/\/v6\/main\/init/.test(url)) {
      filterInit(obj);
    } else if (/\/v6\/main\/indexV8/.test(url)) {
      filterIndexV8(obj);
    } else if (/\/v6\/page\/dataList/.test(url)) {
      filterDataList(obj);
    } else if (/\/v6\/account\/loadConfig/.test(url)) {
      filterMyPage(obj);
    } else if (/\/v6\/feed\/detail/.test(url)) {
      filterDetail(obj);
    } else if (/\/v6\/feed\/replyList/.test(url)) {
      filterReplyList(obj);
    } else {
      $done({});
      return;
    }
    $done({ body: JSON.stringify(obj) });
  } catch (e) {
    // 解析失败：原样放回，不影响正常浏览
    $done({});
  }

  // main/init：删开屏配置键 + 指定推广位 + 嵌套 entities 里的推广位
  // 原 jq：.data[].extraDataArr |= with_entries(select(.key |
  //   (startswith("SplashAd") or startswith("Ad.PRELOAD") or
  //    startswith("Ad.SPLASH") or startswith("Ad.ADLOAD")) | not))
  //   | del(.data[]? | select(.entityId == 944 or 945 or 24455 or 36839 or 1635
  //   or .title == "关注"))
  //   | .data |= map(if .entities then .entities |= map(select(
  //   .entityId != 1635/2261/1633/413/417/1754/1966/2274/1170/1175/1190/2258
  //   and .title != "关注")) else . end)
  // 实测这 17 个键控制开屏：SplashAd.Type / Expires / onResume / resumeType /
  // resumeExpires / openType / sensorDelay / sensitivity / timeout / hType，
  // Ad.PRELOAD / PRELOAD_AFTER_USE / PRELOAD_THRESHOLD / PRELOAD_THRESHOLD_IOS /
  // SPLASH_DOWNLOAD_POPUP / SPLASH_RETRY_PERIOD / ADLOAD_POS_ID
  function filterInit(obj) {
    if (!obj || !Array.isArray(obj.data)) return;
    var removeIds = [944, 945, 24455, 36839, 1635];
    var nestedRemoveIds = [1635, 2261, 1633, 413, 417, 1754, 1966, 2274, 1170, 1175, 1190, 2258];
    var splashKey = /^(SplashAd|Ad\.PRELOAD|Ad\.SPLASH|Ad\.ADLOAD)/;
    obj.data = obj.data.filter(function (item) {
      if (!item || typeof item !== "object") return true;
      if (removeIds.indexOf(item.entityId) !== -1) return false;
      if (item.title === "关注") return false;
      return true;
    });
    obj.data.forEach(function (item) {
      var arr = item.extraDataArr;
      if (arr && typeof arr === "object") {
        if (Array.isArray(arr)) {
          // 兼容 extraDataArr 是 [{key, value}] 数组的形态
          item.extraDataArr = arr.filter(function (e) {
            return !e || typeof e.key !== "string" || !splashKey.test(e.key);
          });
        } else {
          Object.keys(arr).forEach(function (k) {
            if (splashKey.test(k)) delete arr[k];
          });
        }
      }
      if (Array.isArray(item.entities)) {
        item.entities = item.entities.filter(function (e) {
          return e && nestedRemoveIds.indexOf(e.entityId) === -1 && e.title !== "关注";
        });
      }
    });
  }

  // main/indexV8：去掉“值得买 / 红包”类推广及 sponsorCard
  // 原 jq：.data |= map(select((.entityId != 32557 and 29349 and 28621)
  //   and (.entityTemplate != "sponsorCard")
  //   and (.title | test("值得买|红包") | not)))
  function filterIndexV8(obj) {
    if (!obj || !Array.isArray(obj.data)) return;
    var removeIds = [32557, 29349, 28621];
    obj.data = obj.data.filter(function (item) {
      if (!item || typeof item !== "object") return true;
      if (removeIds.indexOf(item.entityId) !== -1) return false;
      if (item.entityTemplate === "sponsorCard") return false;
      if (typeof item.title === "string" && /值得买|红包/.test(item.title)) return false;
      return true;
    });
  }

  // page/dataList：去掉“话题热议”、推广卡片及 sponsorCard；嵌套 entities
  // 里去掉“睡个好觉需要什么？”和 sponsorCard
  // 原 jq：.data |= map(select(.title != "话题热议"
  //   and (.entityTemplate != "sponsorCard")
  //   and (.entityId != 36104/24309/12889/21063/35730/35846/28374/28375/
  //   27332/20090/28773/29343/21106))
  //   | if .entities then (.entities |= map(select(.title != "睡个好觉需要什么？"
  //   and .entityTemplate != "sponsorCard"))) else . end)
  function filterDataList(obj) {
    if (!obj || !Array.isArray(obj.data)) return;
    var removeIds = [36104, 24309, 12889, 21063, 35730, 35846, 28374, 28375, 27332, 20090, 28773, 29343, 21106];
    obj.data = obj.data.filter(function (item) {
      if (!item || typeof item !== "object") return true;
      if (item.title === "话题热议") return false;
      if (item.entityTemplate === "sponsorCard") return false;
      if (removeIds.indexOf(item.entityId) !== -1) return false;
      return true;
    });
    obj.data.forEach(function (item) {
      if (Array.isArray(item.entities)) {
        item.entities = item.entities.filter(function (e) {
          return e && e.title !== "睡个好觉需要什么？" && e.entityTemplate !== "sponsorCard";
        });
      }
    });
  }

  // account/loadConfig?key=my_page_card_config：去掉 textLink 类推广入口
  // 原 jq：.data |= map(select(.entityType != "textLink"
  //   and (.entityId != 1001 and 1003 and 1004 and 1005))
  //   | if .entities then .entities |= map(select(.entityType != "textLink")) else . end)
  function filterMyPage(obj) {
    if (!obj || !Array.isArray(obj.data)) return;
    var removeIds = [1001, 1003, 1004, 1005];
    obj.data = obj.data.filter(function (item) {
      if (!item || typeof item !== "object") return true;
      if (item.entityType === "textLink") return false;
      if (removeIds.indexOf(item.entityId) !== -1) return false;
      return true;
    });
    obj.data.forEach(function (item) {
      if (Array.isArray(item.entities)) {
        item.entities = item.entities.filter(function (e) {
          return e && e.entityType !== "textLink";
        });
      }
    });
  }

  // feed/detail：清空好物卡与赞助卡，过滤无 id 的热门/置顶回复
  // 原 jq：.data.include_goods = [] | .data.include_goods_ids = []
  //   | .data.detailSponsorCard = []
  //   | if .data.hotReplyRows then .data.hotReplyRows |= map(select(.id != null)) else . end
  //   | if .data.topReplyRows then .data.topReplyRows |= map(select(.id != null)) else . end
  function filterDetail(obj) {
    if (!obj || !obj.data || typeof obj.data !== "object") return;
    obj.data.include_goods = [];
    obj.data.include_goods_ids = [];
    obj.data.detailSponsorCard = [];
    if (Array.isArray(obj.data.hotReplyRows)) {
      obj.data.hotReplyRows = obj.data.hotReplyRows.filter(function (r) {
        return r && r.id != null;
      });
    }
    if (Array.isArray(obj.data.topReplyRows)) {
      obj.data.topReplyRows = obj.data.topReplyRows.filter(function (r) {
        return r && r.id != null;
      });
    }
  }

  // feed/replyList：只保留有 id 且不是 card 型的正常回复（含嵌套 replyRows）
  // 原 jq：.data |= map(select(.id != null and .entityType != "card")
  //   | if .replyRows then .replyRows |= map(select(.id != null
  //   and .entityType != "card")) else . end)
  function filterReplyList(obj) {
    if (!obj || !Array.isArray(obj.data)) return;
    obj.data = obj.data.filter(function (item) {
      return item && item.id != null && item.entityType !== "card";
    });
    obj.data.forEach(function (item) {
      if (Array.isArray(item.replyRows)) {
        item.replyRows = item.replyRows.filter(function (r) {
          return r && r.id != null && r.entityType !== "card";
        });
      }
    });
  }
})();
