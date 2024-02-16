# My blog

## Reference

1. https://github.com/ppoffice/hexo-theme-icarus

2. https://xie.infoq.cn/article/ac51ce1f6e9434779c35cbb6c

3. https://notes.worstone.cn/article/1112885395/


## Usage

### config page

edit `_config.yml`

### New page

```bash
cd .../Hydraallen.github.io/my-blog/source/_posts

hexo new post "New page title"
```

### test

```bash
hexo g && hexo s
```

### Update

```bash
hexo deploy
```

### Clean
```bash
hexo clean
```

## Write

Add `toc: true` at the beginning part to show the category.

Use `<!--more-->` to hide part of the article.
