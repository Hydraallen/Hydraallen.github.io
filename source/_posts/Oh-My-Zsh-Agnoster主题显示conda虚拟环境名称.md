---
title: Oh-My-Zsh Agnoster主题显示conda虚拟环境名称
date: 2024-02-24 14:20:30
toc: true
tags: Terminal
---

## 前情提要

勉为其难地使用了Anaconda，发现Oh-my-zsh Agnoster主题下显示conda虚拟环境名称的位置巨丑无比（如下图所示）。

![](https://raw.githubusercontent.com/Hydraallen/images/master/img/oldconda.png)

## 修改

<!--more-->

### 修改`~/.condarc`

在`~/.condarc`文件的第一行前加上一行`changeps1: false`

```shell
changeps1: false # 要添加的内容
```

### 修改主题文件

主题文件的位置在`~/.oh-my-zsh/themes/agnoster.zsh-theme`

找到`prompt_virtualenv()`函数并修改成如下形式：

```shell
# Virtualenv: current working virtualenv
prompt_virtualenv() {
  # Initialize env_label as empty
  local env_label=""

  # Get the name of the virtual environment if one is active
  if [[ -n $VIRTUAL_ENV ]]; then
    if [[ "$(basename $VIRTUAL_ENV)" != "anaconda3" ]]; then
      env_label=" $(basename $VIRTUAL_ENV) "
    fi
  fi

  # Get the name of the Anaconda environment if one is active
  if [[ -n $CONDA_PREFIX && "$(basename $CONDA_PREFIX)" != "anaconda3" ]]; then
    if [[ -n $env_label ]]; then
      env_label+="+ $(basename $CONDA_PREFIX) "
    else
      env_label=" $(basename $CONDA_PREFIX) "
    fi
  fi

  # Draw prompt segment if a virtual/conda environment is active and not anaconda3
  if [[ -n $env_label ]]; then
    color=cyan
    prompt_segment $color $PRIMARY_FG
    print -Pn $env_label
  fi
}

```

这个函数的主要思路是在命令行提示符中显示当前激活的虚拟环境或Anaconda环境的名称。它先检查是否有virtualenv环境激活，如果有，就显示它的名称；然后检查是否有Anaconda环境激活，如果有，也显示它的名称。如果两者都激活了，它们的名称都会显示出来。如果环境名称不是"anaconda3"，这个名称才会被显示，以避免显示默认的Anaconda环境。

### 修改prompt显示顺序

修改`build_prompt() `函数以改变显示顺序：

```bash
build_prompt() {
  RETVAL=$?
  prompt_status
  prompt_aws
  prompt_context
  prompt_dir
  prompt_git
  prompt_virtualenv
  prompt_bzr
  prompt_hg
  prompt_end
}
```

**效果展示**

![](https://raw.githubusercontent.com/Hydraallen/images/master/img/newconda.png)

## 参考文章

- [Zsh 开发指南](https://github.com/goreliu/zshguide)
- [If and Else Conditionals in ZSH Script](https://linuxhint.com/if-else-conditionals-zsh-script/)
- [使Oh-My-Zsh！主题Agnoster显示conda虚拟环境名称的配置方法](https://sappharuhi.xyz/index.php/archives/23/)





