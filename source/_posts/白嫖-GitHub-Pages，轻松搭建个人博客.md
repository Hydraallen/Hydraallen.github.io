---
title: 白嫖 GitHub Pages，轻松搭建个人博客
date: 2024-03-05 00:26:23
toc: true
tags: Blog 科技
---



# 引言

[Hexo](https://hexo.io/zh-cn/docs/index.html)是一个快速、简洁且高效的博客框架。使用 Markdown 解析文档，Hexo 能在几秒内生成带有自定义主题并集成各项功能的网站页面。

本文采用 Github Pages + Hexo 的方式，搭建个人博客。

<!--more-->

# 安装Hexo

安装使用hexo之前需要先安装Node.js和Git，当已经安装了Node.js和npm(npm是node.js的包管理工具)，可以通过以下命令安装hexo

``` bash
npm install -g hexo-cli
hexo -v # 查看版本，目前最新版本为 4.3.1
```

可以通过以下命令查看本地是否安装了node.js和npm

```bash
node --version    #检查是否安装了node.js
npm --version     #检查是否安装了npm
```

如下图所示表示已经安装了node.js和npm

![](https://raw.githubusercontent.com/Hydraallen/images/master/img/node+npm.png)

# 创建仓库

**使用个人 GitHub 创建仓库，并配置 GitHub Pages**

⚠️此仓库用于存放个人博客页面，仓库名必须使用 `<GitHub用户名>.github.io` 格式。

仓库创建完成后，可以在仓库根路径下创建一个名为 `index.html` 的静态 HTML 文件来验证个人博客搭建是否成功。

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Blog Test</title>
</head>
<body>
    <h1>Hello, Blog World! ~</h1>
</body>
</html>
```

在 `<GitHub用户名>.github.io` 仓库对应的 GitHub Pages 设置页面 (访问路径为`Settings -> Pages`) 可以找到个人博客的主页访问地址：https://<GitHub 用户名>.github.io。

若能在浏览器中正常访问该地址，即代表个人 GitHub Pages 搭建成功。

# 搭建Blog

## 安装 &配置主题

### 创建一个项目并初始化

```bash
hexo init <folder> #在当前路径下创建一个名字为<folder>的文件夹
cd <folder>
npm install
```

新建完成之后，指定目录中的情况如下

```bash
.
├── _config.yml
├── package.json
├── scaffolds
├── source
|   ├── _drafts
|   └── _posts
└── themes
```

- `_config.yml`

网站的配置信息，可以在此配置大部分的参数。 [配置参数讲解](https://hexo.io/zh-cn/docs/configuration)或[参考我的配置](https://github.com/Hydraallen/Hydraallen.github.io/blob/local/_config.yml)

- `package.json`

应用程序的信息，以及需要安装的模块信息。

- `source`

资源文件夹是存放用户资源的地方，如markdown文章。**Markdown 和 HTML 文件会被解析并放到 `public` 文件夹**，而其他文件会被拷贝过去。

> 注意：除 `_posts` 文件夹之外，开头命名为 `_` (下划线)的文件 / 文件夹和隐藏的文件将会被忽略。

- `themes`

主题文件夹。Hexo 会根据主题来解析source目录中的markdown文件生成静态页面。[官网主题详述](https://hexo.io/zh-cn/docs/configuration)

**在`_config.yml`中修改主题**

```
theme: icarus  # 指定主题
```

**推荐主题**

- [icarus](https://github.com/ppoffice/hexo-theme-icarus)
- [Hexo-LiveForCode](https://github.com/first19326/Hexo-LiveForCode)

*具体主题配置请参考官方文档，目前我使用[icarus主题](https://github.com/Hydraallen/Hydraallen.github.io/blob/local/_config.icarus.yml)。*

### 生成网页&本地启动

```bash
hexo clean # 清理生成的页面文件
hexo generate # 生成页面，此命令可以简写为 `hexo g`
hexo server # 本地启动，可简写为 `hexo s`
```

浏览器访问：http://localhost:4000/ 会看到页面。

## 文章写作&发布

### 新页面

```bash
hexo new post "New page title"
```

如上命令执行成功后，在 `source/_posts/` 目录下生成了一个 Markdown 文件和一个同名的资源目录（可设置）。

### 本地测试

```bash
hexo g && hexo s
```

浏览器访问：http://localhost:4000/

### 内容写作

在文章头部添加 `toc: true` 以暂时目录

使用 `<!--more-->`隐藏内容

### Git发布

1. **安装** **`hexo-deployer-git`**

```bash
npm install hexo-deployer-git --save
```

2. **修改站点配置** [**`_config.yml`**](https://github.com/Hydraallen/Hydraallen.github.io/blob/local/_config.yml)

```bash
deploy:
  type: git
  repo: <repository url> # https://github.com/<GitHub用户名>/<GitHub用户名>.github.io.git
  branch: [branch]
  token: [token]

```

3. **生成站点文件并推送至远程 GitHub 仓库**

```bash
hexo clean
hexo deploy
```

登入 Github，在库设置（Repository Settings）中将默认分支设置为 `_config.yml` 配置中的分支名称。

只需稍等片刻，个人博客站点就会显示在 Github Pages 中。

## 参考资料

- [Hexo Docs](https://hexo.io/zh-cn/docs/)
- [Hexo Fluid 用户手册](https://fluid-dev.github.io/hexo-fluid-docs/)
- [基于Github Pages+Hexo 搭建个人博客，如何实现](https://xie.infoq.cn/article/ac51ce1f6e9434779c35cbb6c)
- [Hexo 基础 —— Hexo 的原理、配置及基本使用方法](https://cnneillee.github.io/2016/03/09/hexo/hexo%E5%9F%BA%E7%A1%80/)
- [Hexo主题LiveForCode介绍](https://notes.worstone.cn/article/1112885395/)
