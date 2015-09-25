##wechat web rebuild team dev tool


###about us
<http://mmrb.github.io>

###installation

```shell
npm install --save-dev server-mm
```

###usage

```javascript
var gulp = require("gulp");
var serverM = require("server-mm");

server.start({
    root: __dirname + "/",
    port:8080,
    tmpl: __dirname + "/tmpl.json",
    fileNotFoundFunc: function(path){ // when file not found
        return path.replace(/(\/|\\)zh_CN/g, "$1htdocs$1zh_CN");
    }
});
```