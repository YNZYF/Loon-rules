/*
  kuan-loon.js — 酷安信息流推广卡片过滤（配合 kuan-loon.plugin 使用）
  来源：2026-11-13 酷安 iOS 16.7.2 抓包，api.coolapk.com/v6/main/indexV8 等接口
  返回的 data 是数组，每一项带 entityType / entityTemplate；推广卡片带 sponsor / ad 标记。
  逻辑只做一件事：删掉带明确广告标记的项，其他原样放回。
  解析失败、结构不对时原样放回，绝不拦断正常内容。
*/
(function () {
  var body = $response.body;
  try {
    var obj = JSON.parse(body);
    var list = null;
    if (obj && Array.isArray(obj.data)) {
      list = obj.data;
    } else if (obj && obj.data && Array.isArray(obj.data.list)) {
      list = obj.data.list;
    }
    if (!list) {
      $done({});
      return;
    }
    var filtered = list.filter(function (item) {
      return !isAd(item);
    });
    if (obj.data && Array.isArray(obj.data.list)) {
      obj.data.list = filtered;
    } else {
      obj.data = filtered;
    }
    $done({ body: JSON.stringify(obj) });
  } catch (e) {
    // 解析失败：原样放回，不影响正常浏览
    $done({});
  }

  function isAd(item) {
    if (!item || typeof item !== "object") return false;
    // 明确的布尔标记
    if (item.sponsor === true || item.isSponsor === true || item.isAd === true) return true;
    if (item.ad === true || item.isAdvertisement === true) return true;
    // 类型 / 模板名带 ad / sponsor
    var kind = (item.entityType || "") + "|" + (item.entityTemplate || "");
    if (/ad|sponsor|promotion/i.test(kind)) return true;
    // extraData 常是 JSON 字符串，里面带 sponsor 标记
    var extra = item.extraData || item.extraDataArr || "";
    if (typeof extra === "string" && /sponsor|isAd/i.test(extra)) return true;
    // 兜底：整项里出现明确的 sponsor 字段名（不用裸 "ad" 匹配，避免误伤 download 这类词）
    var s = JSON.stringify(item);
    if (/"sponsor"\s*:/i.test(s)) return true;
    if (/"isAd"\s*:\s*true/i.test(s)) return true;
    if (/"adType"\s*:/i.test(s)) return true;
    return false;
  }
})();
