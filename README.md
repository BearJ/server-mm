##wechat web rebuild team dev tool


###关于我们
<http://mmrb.github.io>

###安装

```shell
npm install --save-dev server-mm
```

###用例

```javascript
var server = require("server-mm");

server.start({
    root: __dirname + "/", // 根目录
    port:8080, // 端口
    tmpl: __dirname + "/tmpl.json", // 存放模板参数的文件
    encoding: "utf8", // 项目的默认编码，不填为utf8
    fileNotFoundFunc: function(path){ // 当文件没找到时，会调用此方法，用于当本地和线上路径不一致时，修改路径以预览
        return path.replace(/(\/|\\)zh_CN/g, "$1htdocs$1zh_CN");
    }
});
```

###tmpl.json范例

```javascript
{
  "projectname": "mmsupport",
  "stationery_path": "/htdocs/zh_CN/",
  "images_path": "/htdocs/zh_CN/htmledition/images/",
  "js_path": "/htdocs/zh_CN/htmledition/js/",
  "css_path": "/htdocs/zh_CN/htmledition/style/",
  "lang": "zh_CN",
  "Language": "zh_CN",
  "retdata": {
      "a": "1",
      "b": "2"
  }

  "GetAllVar": function(arg){return JSON.stringify(this);}
}
```