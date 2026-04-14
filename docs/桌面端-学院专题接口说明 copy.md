# 桌面端调用说明（学院专题）

本文面向桌面端，说明页面  
`https://1m1sj.daoker.wang/h5/#/pages/home/article/list`  
对应的后端接口、调用顺序和关键字段。

---

## 1. 页面对应接口清单

根据前端页面实现，实际使用到以下接口：

1. `plus.article.article/category`（专题分类）
2. `plus.article.article/index`（专题列表）
3. `plus.article.article/detail`（专题详情）
4. `index/share`（仅 H5 微信分享配置，桌面端一般可不接）

前端来源文件：
- `1m1sj_frontend/pages/home/article/list.vue`
- `1m1sj_frontend/pages/home/article/detail.vue`

后端来源文件：
- `1m1sj_backend/app/api/controller/plus/article/Article.php`
- `1m1sj_backend/app/api/model/plus/article/Article.php`
- `1m1sj_backend/app/api/controller/Index.php`（`share`）

---

## 2. 基础请求规则

- 请求基址：`{API_BASE}/api/{path}`
- 所有接口都需要：`app_id`
- 这组接口默认不要求用户登录 token（除非你们网关另做限制）

统一成功响应：

```json
{
  "code": 1,
  "msg": "success",
  "data": {}
}
```

统一失败响应：

```json
{
  "code": 0,
  "msg": "错误说明",
  "data": {}
}
```

---

## 3. 推荐调用顺序（桌面端）

### 3.1 专题列表页加载

1. 调 `category` 拉取分类
2. 调 `index` 拉取列表（默认 `category_id=0`）
3. 切换分类时重复调 `index`

### 3.2 专题详情页加载

1. 从列表拿到 `article_id`
2. 调 `detail` 拉取详情
3. （可选）若你桌面端有微信内分享，才调 `index/share`

---

## 4. 接口说明

## 4.1 获取专题分类

- 路径：`plus.article.article/category`
- 方法：`GET`
- 必填参数：
  - `app_id`

返回示例（节选）：

```json
{
  "code": 1,
  "msg": "",
  "data": {
    "category": [
      {
        "category_id": 10001,
        "name": "分类A",
        "sort": 1,
        "create_time": 1710000000
      }
    ]
  }
}
```

---

## 4.2 获取专题列表

- 路径：`plus.article.article/index`
- 方法：`GET`
- 必填参数：
  - `app_id`
- 可选参数：
  - `page`（默认 1）
  - `list_rows`（默认后端分页参数）
  - `category_id`（`0`=全部）

请求示例：

```text
/api/plus.article.article/index?app_id=10001&page=1&list_rows=20&category_id=0
```

返回示例（节选）：

```json
{
  "code": 1,
  "msg": "",
  "data": {
    "list": {
      "current_page": 1,
      "last_page": 8,
      "per_page": 20,
      "total": 152,
      "data": [
        {
          "article_id": 123,
          "article_title": "专题标题",
          "dec": "简介",
          "category_id": 10001,
          "actual_views": 56,
          "virtual_views": 100,
          "view_time": 156,
          "create_time": "2026-04-08 10:00:00",
          "image": {
            "file_path": "https://..."
          },
          "category": {
            "name": "分类A"
          }
        }
      ]
    }
  }
}
```

实现细节（后端）：
- 仅返回 `article_status=1` 且 `is_delete=0` 的记录
- 默认会排除 `category_id=10025`（因为控制器调用时 `type=true`）
- 排序：`article_sort asc, create_time desc`

---

## 4.3 获取专题详情

- 路径：`plus.article.article/detail`
- 方法：`GET`
- 必填参数：
  - `app_id`
  - `article_id`

请求示例：

```text
/api/plus.article.article/detail?app_id=10001&article_id=123
```

返回示例（节选）：

```json
{
  "code": 1,
  "msg": "",
  "data": {
    "detail": {
      "article_id": 123,
      "article_title": "专题标题",
      "article_content": "<p>正文HTML</p>",
      "video_url": "",
      "create_time": "2026-04-08 10:00:00",
      "actual_views": 57,
      "view_time": 157,
      "image": {
        "file_path": "https://..."
      },
      "category": {
        "name": "分类A"
      }
    }
  }
}
```

实现细节（后端）：
- 若 `article_id` 不存在，会返回错误“文章不存在”
- 每次成功访问详情会自动 `actual_views + 1`
- `article_content` 在模型里做了 `htmlspecialchars_decode`

---

## 4.4 微信分享配置（可选）

> 仅当你的桌面容器需要复用微信 H5 分享时才需要；普通桌面端可忽略。

- 路径：`index/share`
- 方法：`GET`
- 参数（常用）：
  - `app_id`
  - `url`（当前页面完整 URL，用于签名）
  - `title`
  - `desc`
  - `link`
  - `imgUrl`

返回：`signPackage` + `shareParams`

---

## 5. 桌面端最小实现建议

如果你只要“专题列表 + 详情”：

1. 启动加载：`category` + `index`
2. 分类切换：重调 `index`
3. 点击卡片：调 `detail`
4. 分页：用 `list.current_page / last_page` 控制继续加载

不依赖登录、也不依赖桌面扫码登录 token。

