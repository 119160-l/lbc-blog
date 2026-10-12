#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
make-matrix-figures.py —— 补出「矩阵论」知识讲解里引用、但从未生成过的 7 张配图。

背景：posts/matrix 的这两篇正文里写了 ![](./figures/xx.png)，
      但源笔记目录（~/Downloads/基础课程/矩阵论）里一张 png 都没有，
      线上因此显示「配图缺失」占位。这里按文件名逐张画出来。

输出：
  posts/matrix/第1章-线性空间与线性变换/figures/01_线性变换的几何直观.png
  posts/matrix/第1章-线性空间与线性变换/figures/03_特征向量方向不变.png
  posts/matrix/第1章-线性空间与线性变换/figures/04_Schmidt正交化过程.png
  posts/matrix/第4章-矩阵分解/figures/01_Householder变换的几何意义.png
  posts/matrix/第4章-矩阵分解/figures/02_Givens旋转示意.png
  posts/matrix/第4章-矩阵分解/figures/03_SVD的几何意义.png
  posts/matrix/第4章-矩阵分解/figures/04_SVD图像压缩.png

用法：
  /Users/lbc/.workbuddy/binaries/python/envs/default/bin/python make-matrix-figures.py
"""

import os
import numpy as np
import matplotlib

matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, Arc, Polygon, Rectangle

# 绝对路径：沙盒下 process.cwd() 可能给出大小写错误的路径，相对路径不可靠
ROOT = '/Users/lbc/WorkBuddy/Claw/lbc-blog'
CH1 = os.path.join(ROOT, 'posts', 'matrix', '第1章-线性空间与线性变换', 'figures')
CH4 = os.path.join(ROOT, 'posts', 'matrix', '第4章-矩阵分解', 'figures')

# 与站内其它配图统一：白底 + 蓝/橙主色
BLUE = '#4dabf5'
ORANGE = '#ff794e'
GREEN = '#22c55e'
PURPLE = '#a78bfa'
GRAY = '#94a3b8'
INK = '#1f2937'
FAINT = '#e2e8f0'

plt.rcParams.update({
    'font.sans-serif': ['PingFang SC', 'Arial Unicode MS', 'Hiragino Sans GB'],
    'axes.unicode_minus': False,
    'figure.facecolor': 'white',
    'savefig.facecolor': 'white',
    'axes.facecolor': 'white',
    'axes.edgecolor': '#cbd5e1',
    'axes.linewidth': 0.9,
    'text.color': INK,
    'axes.labelcolor': '#334155',
    'xtick.color': '#64748b',
    'ytick.color': '#64748b',
    'font.size': 10.5,
    'savefig.bbox': 'tight',
    'savefig.dpi': 150,
})


# ---------------------------------------------------------------- 小工具
def arrow(ax, p, q, color, lw=2.2, ls='-', alpha=1.0, z=5, mut=14):
    """画一根带箭头的向量"""
    ax.add_patch(FancyArrowPatch(p, q, arrowstyle='-|>', mutation_scale=mut,
                                 color=color, lw=lw, linestyle=ls, alpha=alpha,
                                 shrinkA=0, shrinkB=0, zorder=z))


def bare(ax):
    ax.set_xticks([])
    ax.set_yticks([])


def right_angle(ax, corner, d1, d2, size=0.14, color=GRAY):
    """在 corner 处画直角符号"""
    d1 = np.asarray(d1, float) / np.linalg.norm(d1) * size
    d2 = np.asarray(d2, float) / np.linalg.norm(d2) * size
    c = np.asarray(corner, float)
    pts = [c + d1, c + d1 + d2, c + d2]
    ax.plot([p[0] for p in pts], [p[1] for p in pts], color=color, lw=1.1, zorder=6)


def perp(v, k=1.0):
    v = np.asarray(v, float)
    v = v / np.linalg.norm(v)
    return np.array([-v[1], v[0]]) * k


def save(fig, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fig.savefig(path)
    plt.close(fig)
    print(f'  {os.path.basename(path)}  {os.path.getsize(path) / 1024:.0f} KB')


# ---------------------------------------------------------------- 1. 线性变换的几何直观
def fig_linear_map():
    A = np.array([[1.6, 0.6], [0.4, 1.3]])
    grid = np.linspace(-2.4, 2.4, 13)
    t = np.linspace(-2.4, 2.4, 160)
    lim = 2.55

    fig, axes = plt.subplots(1, 2, figsize=(10.8, 4.7))

    ax = axes[0]
    for g in grid:
        ax.plot([g, g], [-lim, lim], color=FAINT, lw=0.9, zorder=1)
        ax.plot([-lim, lim], [g, g], color=FAINT, lw=0.9, zorder=1)
    ax.add_patch(Polygon([[0, 0], [1, 0], [1, 1], [0, 1]], closed=True,
                         facecolor=BLUE, alpha=0.22, edgecolor=BLUE, lw=1.6, zorder=2))
    arrow(ax, (0, 0), (1, 0), BLUE)
    arrow(ax, (0, 0), (0, 1), ORANGE)
    ax.text(1.1, -0.09, '$e_1$', color=BLUE, fontsize=12.5, fontweight='bold')
    ax.text(-0.34, 1.06, '$e_2$', color=ORANGE, fontsize=12.5, fontweight='bold')
    ax.text(1.55, 0.46, '单位正方形', ha='center', va='center', fontsize=10, color='#1e5f9e')
    ax.set_title('原空间：标准网格 + 标准基', fontweight='bold', fontsize=12)
    ax.set_xlim(-lim, lim)
    ax.set_ylim(-lim, lim)
    ax.set_aspect('equal')
    bare(ax)

    ax = axes[1]
    for g in grid:
        p = A @ np.vstack([np.full_like(t, g), t]).reshape(2, -1)
        ax.plot(p[0], p[1], color=FAINT, lw=0.9, zorder=1)
        p = A @ np.vstack([t, np.full_like(t, g)]).reshape(2, -1)
        ax.plot(p[0], p[1], color=FAINT, lw=0.9, zorder=1)
    ax.add_patch(Polygon([[0, 0], [1, 0], [1, 1], [0, 1]], closed=True,
                         fill=False, edgecolor=GRAY, lw=1.3, ls='--', zorder=3))
    ax.add_patch(Polygon([[0, 0], A[:, 0], A @ np.array([1, 1]), A[:, 1]], closed=True,
                         facecolor=BLUE, alpha=0.22, edgecolor=BLUE, lw=1.6, zorder=2))
    arrow(ax, (0, 0), tuple(A[:, 0]), BLUE)
    arrow(ax, (0, 0), tuple(A[:, 1]), ORANGE)
    ax.text(*(A[:, 0] + [0.12, -0.22]), '$Ae_1$', color=BLUE, fontsize=12.5, fontweight='bold')
    ax.text(*(A[:, 1] + [-0.62, -0.02]), '$Ae_2$', color=ORANGE, fontsize=12.5, fontweight='bold')
    ax.text(-lim + 0.08, -lim + 0.12,
            '虚线方框：原来的单位正方形\n蓝色：变换后的像（平行四边形）',
            fontsize=10, color='#334155', va='bottom', linespacing=1.6,
            bbox=dict(facecolor='white', edgecolor='#e2e8f0',
                      boxstyle='round,pad=0.35', alpha=0.94))
    ax.set_title('像空间：同一个网格被 $A$ 拉伸、剪切', fontweight='bold', fontsize=12)
    ax.set_xlim(-lim, lim)
    ax.set_ylim(-lim, lim)
    ax.set_aspect('equal')
    bare(ax)

    fig.suptitle('线性变换的几何直观：网格随基向量一起动，正方形变成平行四边形',
                 fontsize=13.5, fontweight='bold', y=1.0)
    save(fig, os.path.join(CH1, '01_线性变换的几何直观.png'))


# ---------------------------------------------------------------- 2. 特征向量方向不变
def fig_eigenvector():
    A = np.array([[1.8, 0.8], [0.8, 1.2]])
    w, V = np.linalg.eigh(A)
    order = np.argsort(-w)
    w, V = w[order], V[:, order]
    for k in range(2):                       # 特征向量符号是任意的，固定成 x 分量 > 0，图才稳定
        if V[0, k] < 0:
            V[:, k] = -V[:, k]

    # 找一个「被转向最厉害」的方向，别用偏转不到 10° 的例子
    best = (0.0, np.array([1.0, 0.0]))
    for a in np.linspace(0, 180, 1801):
        v = np.array([np.cos(np.radians(a)), np.sin(np.radians(a))])
        av = A @ v
        turn = abs(np.degrees(np.arctan2(av[1], av[0]) - np.arctan2(v[1], v[0])))
        turn = min(turn, 360 - turn)
        if turn > best[0]:
            best = (turn, v)
    turn, v = best
    Av = A @ v

    fig, axes = plt.subplots(1, 2, figsize=(10.8, 4.9))
    lim = 2.6
    limL = 1.62

    # 左：一般方向会被转向（v 画成真正的单位长度，Av 画成真实长度，长度对比才诚实）
    av_ang = np.degrees(np.arctan2(Av[1], Av[0]))
    v_ang = np.degrees(np.arctan2(v[1], v[0]))
    ax = axes[0]
    tl = np.linspace(-limL, limL, 10)
    ax.plot(tl * v[0], tl * v[1], color=GRAY, lw=1.2, ls='--', zorder=1)
    # 注意 theta1/theta2 的顺序：Arc 总是逆时针画，反着给会画出将近整圈
    ax.add_patch(Arc((0, 0), 0.62, 0.62, theta1=min(v_ang, av_ang), theta2=max(v_ang, av_ang),
                     color=ORANGE, lw=1.7, zorder=4))
    arrow(ax, (0, 0), tuple(v), BLUE, lw=2.5)
    arrow(ax, (0, 0), tuple(Av), ORANGE, lw=2.5)
    ax.text(*(v + np.array([-0.24, -0.04])), '$v$', color=BLUE, fontsize=12.5, fontweight='bold')
    ax.text(*(Av + np.array([0.08, 0.06])), '$Av$', color=ORANGE, fontsize=12.5, fontweight='bold')
    ax.text(0.34, 0.5, f'{turn:.1f}°', color=ORANGE, fontsize=11.5, fontweight='bold')
    ax.text(-limL + 0.05, -limL + 0.04,
            '一般方向：$Av$ 与 $v$ 不在一条直线上\n'
            f'方向偏转 {turn:.1f}°；$\\|v\\|=1$ 而 $\\|Av\\|={np.linalg.norm(Av):.2f}$',
            fontsize=10.5, color='#334155', linespacing=1.6, va='bottom')
    ax.set_xlim(-limL, limL)
    ax.set_ylim(-limL, limL)
    ax.set_aspect('equal')
    bare(ax)
    ax.set_title('非特征方向：转向', fontweight='bold', fontsize=12)

    # 右：特征方向只伸缩（两根箭头错开一点，否则完全重叠看不见）
    ax = axes[1]
    for k in range(2):
        e = V[:, k]
        lam = w[k]
        col = GREEN if k == 0 else PURPLE
        p = perp(e, 0.075)
        lp = perp(e, 1.0)
        tl = np.linspace(-lim, lim, 10)
        ax.plot(tl * e[0], tl * e[1], color=col, lw=1.1, ls=':', zorder=1)
        arrow(ax, (0, 0) + p, e + p, col, lw=2.0, alpha=0.9, z=5)
        arrow(ax, (0, 0) - p, lam * e - p, ORANGE, lw=2.5, z=6)
        ax.plot([(e + p)[0], (lam * e - p)[0]], [(e + p)[1], (lam * e - p)[1]],
                color=GRAY, lw=0.9, ls='--', zorder=4)
        ax.text(*(e + p + lp * 0.30), f'$v_{k+1}$',
                color=col, fontsize=11.5, fontweight='bold', ha='center')
        ax.text(2.10, 2.24 - 0.42 * k, f'$\\lambda_{k+1}={lam:.2f}$',
                color=col, fontsize=11.5, fontweight='bold', ha='left')
    ax.text(-lim + 0.08, lim - 0.22, '特征方向：$Av$ 与 $v$ 共线，只被拉长/压短',
            fontsize=11, color='#334155')
    ax.text(-lim + 0.08, lim - 0.55, '同一方向的两根箭头：彩色 $= v$（单位向量），橘色 $= Av=\\lambda v$',
            fontsize=10.5, color='#64748b')
    ax.set_xlim(-lim, lim)
    ax.set_ylim(-lim, lim)
    ax.set_aspect('equal')
    bare(ax)
    ax.set_title('特征方向：伸缩', fontweight='bold', fontsize=12)

    fig.suptitle('特征向量方向不变：$Av=\\lambda v$ —— 方向锁定，长度乘以 $\\lambda$',
                 fontsize=13.5, fontweight='bold', y=1.0)
    save(fig, os.path.join(CH1, '03_特征向量方向不变.png'))
    return turn, w


# ---------------------------------------------------------------- 3. Schmidt 正交化
def fig_schmidt():
    v1 = np.array([2.2, 0.7])
    v2 = np.array([1.0, 2.0])
    e1 = v1 / np.linalg.norm(v1)
    proj = (v2 @ e1) * e1
    w2 = v2 - proj
    e2 = w2 / np.linalg.norm(w2)

    fig, axes = plt.subplots(1, 2, figsize=(11.0, 5.0), gridspec_kw={'width_ratios': [1, 0.85]})

    # 左：几何
    ax = axes[0]
    tl = np.linspace(-0.6, 3.0, 10)
    ax.plot(tl * e1[0], tl * e1[1], color=GREEN, lw=1.1, ls=':', zorder=1)
    arrow(ax, (0, 0), tuple(v1), BLUE, lw=2.4)
    arrow(ax, (0, 0), tuple(v2), BLUE, lw=2.4, ls='--', alpha=0.8)
    arrow(ax, (0, 0), tuple(e1), GREEN, lw=2.6, z=6)
    ax.plot([0, proj[0]], [0, proj[1]], color=GRAY, lw=1.8, ls='--', zorder=3)
    arrow(ax, tuple(proj), tuple(v2), ORANGE, lw=2.6, z=7)
    arrow(ax, (0, 0), tuple(w2), ORANGE, lw=1.4, ls=':', alpha=0.6, z=3)
    right_angle(ax, tuple(proj), tuple(v2 - proj), tuple(-proj), size=0.17)

    ax.text(*(v1 + np.array([0.06, -0.24])), '$v_1$', color=BLUE, fontsize=12.5, fontweight='bold')
    ax.text(*(v2 + np.array([0.08, 0.04])), '$v_2$', color=BLUE, fontsize=12.5, fontweight='bold')
    ax.text(*(e1 + np.array([-0.1, 0.16])), '$e_1$', color=GREEN, fontsize=12.5, fontweight='bold')
    ax.text(*(proj + (v2 - proj) * 0.5 + np.array([0.14, 0.02])), '$w_2$', color=ORANGE,
            fontsize=12.5, fontweight='bold')
    ax.text(*(proj + np.array([0.12, -0.20])), '投影\n$(v_2\\cdot e_1)e_1$',
            color=GRAY, fontsize=10, ha='left', va='top', linespacing=1.5)
    ax.text(-0.55, 2.95, '橘色虚线：把 $w_2$ 平移到原点 —— 它就是与 $e_1$ 垂直的那个方向',
            fontsize=10, color='#64748b')
    ax.set_xlim(-0.7, 3.1)
    ax.set_ylim(-0.5, 3.25)
    ax.set_aspect('equal')
    bare(ax)
    ax.set_title('几何：从 $v_2$ 里减掉「顺着 $v_1$ 的那一段」', fontweight='bold', fontsize=12)

    # 右：文字说明 + 数值校验
    ax = axes[1]
    ax.axis('off')
    ax.text(0.0, 1.0, '三步走', fontsize=13, fontweight='bold', color='#334155',
            transform=ax.transAxes)
    steps = [
        ('①', '$e_1 = \\dfrac{v_1}{\\|v_1\\|}$', GREEN),
        ('②', '$w_2 = v_2 - (v_2\\cdot e_1)\\,e_1$', GRAY),
        ('③', '$e_2 = \\dfrac{w_2}{\\|w_2\\|}$', ORANGE),
    ]
    y = 0.86
    for tag, tex, col in steps:
        ax.text(0.0, y, tag, fontsize=14, fontweight='bold', color=col, transform=ax.transAxes)
        ax.text(0.09, y, tex, fontsize=13, color=INK, transform=ax.transAxes)
        y -= 0.115
    ax.text(0.0, y - 0.02,
            '$\\|w_2\\|$ 就是 $v_2$ 到 $e_1$ 所在\n直线的「距离」，必然 $\\geq 0$',
            fontsize=10, color='#64748b', transform=ax.transAxes, linespacing=1.5)
    ax.plot([0.0, 1.0], [0.44, 0.44], color=FAINT, lw=1.5, transform=ax.transAxes,
            clip_on=False, solid_capstyle='butt')
    ax.text(0.0, 0.35, '数值校验', fontsize=12, fontweight='bold', color='#334155',
            transform=ax.transAxes)
    checks = [
        f'$e_1\\cdot e_2 = {e1 @ e2:+.1e}$   （正交）',
        f'$\\|e_1\\| = {np.linalg.norm(e1):.3f}$,  $\\|e_2\\| = {np.linalg.norm(e2):.3f}$',
        f'投影长度 $= {np.linalg.norm(proj):.3f}$,  $\\|w_2\\| = {np.linalg.norm(w2):.3f}$',
    ]
    y = 0.25
    for c in checks:
        ax.text(0.0, y, c, fontsize=11, color='#334155', transform=ax.transAxes)
        y -= 0.105
    ax.text(0.0, y - 0.05,
            '三个向量张成同一个平面，\n换了正交基之后计算和判断都变简单。',
            fontsize=10.5, color='#64748b', transform=ax.transAxes, linespacing=1.5)

    fig.suptitle('Gram–Schmidt 正交化：把一组斜向量改造成正交单位基',
                 fontsize=13.5, fontweight='bold', y=1.02)
    save(fig, os.path.join(CH1, '04_Schmidt正交化过程.png'))
    return float(e1 @ e2), float(np.linalg.norm(w2))


# ---------------------------------------------------------------- 4. Householder
def fig_householder():
    fig, axes = plt.subplots(1, 2, figsize=(10.8, 4.9))
    lim = 2.6

    # 左：镜像几何
    ax = axes[0]
    x = np.array([1.45, 1.25])
    d = np.array([np.cos(np.radians(-24)), np.sin(np.radians(-24))])
    nv = np.array([-d[1], d[0]])
    Hx = x - 2 * (x @ nv) * nv
    t = np.linspace(-2.4, 2.4, 10)
    ax.plot(t * d[0], t * d[1], color=PURPLE, lw=2.0, zorder=2)
    ax.text(*(2.15 * d + np.array([0.06, -0.3])), '反射平面', color=PURPLE,
            fontsize=11, fontweight='bold')
    arrow(ax, (0, 0), tuple(nv * 1.25), GRAY, lw=1.8)
    arrow(ax, (0, 0), tuple(x), BLUE, lw=2.5)
    arrow(ax, (0, 0), tuple(Hx), ORANGE, lw=2.5)
    ax.plot([x[0], Hx[0]], [x[1], Hx[1]], color=GRAY, lw=1.1, ls='--', zorder=3)
    right_angle(ax, tuple((x + Hx) / 2), tuple(x - Hx), tuple(d), size=0.17)
    ax.text(*(x + np.array([0.1, 0.08])), '$x$', color=BLUE, fontsize=12.5, fontweight='bold')
    ax.text(*(Hx + np.array([0.1, -0.28])), '$Hx$', color=ORANGE, fontsize=12.5, fontweight='bold')
    ax.text(*(nv * 1.25 + np.array([0.12, 0.14])), '$v$', color=GRAY, fontsize=12, fontweight='bold')
    ax.text(*(nv * 0.55 + np.array([-0.55, 0.06])), '沿 $v$ 的分量取反',
            fontsize=10, color=GRAY)
    ax.text(-lim + 0.08, lim - 0.12,
            '关于过原点平面的镜像：\n长度不变 $\\|Hx\\|=\\|x\\|$，$H$ 正交且 $H^2=I$',
            fontsize=10.5, color='#334155', linespacing=1.5, va='top')
    ax.set_xlim(-lim, lim)
    ax.set_ylim(-lim, lim)
    ax.set_aspect('equal')
    bare(ax)
    ax.set_title('几何意义：镜像反射', fontweight='bold', fontsize=12)

    # 右：一步把 x 打到 e1 轴
    ax = axes[1]
    xx = np.array([1.05, 1.5])
    r = float(np.linalg.norm(xx))
    vv = xx - np.array([r, 0.0])
    vv = vv / np.linalg.norm(vv)
    Hxx = np.array([r, 0.0])
    mid = (xx + Hxx) / 2
    tt = np.linspace(-2.4, 2.4, 10)
    ax.plot(mid[0] + tt * vv[1], mid[1] - tt * vv[0], color=PURPLE, lw=2.0, zorder=2)
    arrow(ax, (0, 0), (lim - 0.15, 0), GRAY, lw=1.3, ls='--', z=1)
    arrow(ax, (0, 0), tuple(xx), BLUE, lw=2.5)
    arrow(ax, (0, 0), tuple(Hxx), ORANGE, lw=2.5)
    ax.plot([xx[0], Hxx[0]], [xx[1], Hxx[1]], color=GRAY, lw=1.1, ls='--', zorder=3)
    ax.text(*(xx + np.array([0.1, 0.06])), '$x$', color=BLUE, fontsize=12.5, fontweight='bold')
    ax.text(*(Hxx + np.array([-0.35, -0.34])), '$Hx=(\\|x\\|,0)^\\top$',
            color=ORANGE, fontsize=10.5, fontweight='bold')
    ax.text(lim - 0.1, 0.12, '$e_1$', color=GRAY, fontsize=12, fontweight='bold', ha='right')
    ax.text(-lim + 0.08, -lim + 0.6,
            '工程用途：取 $v \\propto x-\\|x\\|e_1$，一步把 $x$ 在 $e_1$ 上方的\n'
            '分量抹成 0 —— QR 分解、上 Hessenberg 化的基本动作',
            fontsize=10.5, color='#334155', linespacing=1.5)
    ax.set_xlim(-lim, lim)
    ax.set_ylim(-lim, lim)
    ax.set_aspect('equal')
    bare(ax)
    ax.set_title('用途：一步把向量打到 $e_1$ 方向上', fontweight='bold', fontsize=12)

    fig.suptitle('Householder 变换：$H = I-2vv^\\top$（$\\|v\\|=1$）是镜像，也是「消元」的利器',
                 fontsize=13.5, fontweight='bold', y=1.0)
    save(fig, os.path.join(CH4, '01_Householder变换的几何意义.png'))


# ---------------------------------------------------------------- 5. Givens
def fig_givens():
    fig = plt.figure(figsize=(11.4, 4.7))
    gs = fig.add_gridspec(1, 2, width_ratios=[1, 1.25], wspace=0.16)

    # 左：平面内旋转，把 (x,y) 转到 x 轴上
    ax = fig.add_subplot(gs[0, 0])
    p = np.array([1.45, 1.5])
    r = float(np.linalg.norm(p))
    phi = np.arctan2(p[1], p[0])
    q = np.array([r, 0.0])
    ax.plot([-0.3, 2.45], [0, 0], color=FAINT, lw=1.2)
    ax.plot([0, 0], [-0.3, 2.3], color=FAINT, lw=1.2)
    ax.add_patch(Arc((0, 0), 1.0, 1.0, theta1=0, theta2=np.degrees(phi),
                     color=GRAY, lw=1.3, zorder=3))
    arrow(ax, (0, 0), tuple(p), BLUE, lw=2.5)
    arrow(ax, (0, 0), tuple(q), GREEN, lw=2.6)
    ax.plot([p[0], q[0]], [p[1], q[1]], color=GRAY, lw=1.0, ls='--', zorder=2)
    ax.text(0.66, 0.2, '$\\theta$', color=GRAY, fontsize=13, fontweight='bold')
    ax.text(*(p + np.array([0.08, 0.06])), '$(x_i,x_j)^\\top$', color=BLUE,
            fontsize=11.5, fontweight='bold')
    ax.text(*(q + np.array([0.06, -0.34])), '$(r,0)^\\top$', color=GREEN,
            fontsize=11.5, fontweight='bold')
    ax.text(0.05, 2.18, f'$r=\\sqrt{{x_i^2+x_j^2}}={r:.2f}$',
            fontsize=11.5, color='#334155')
    ax.text(-0.28, -0.24, '一次旋转只把 $(i,j)$ 两个分量合起来看',
            fontsize=10, color='#64748b')
    ax.set_xlim(-0.35, 2.55)
    ax.set_ylim(-0.45, 2.35)
    ax.set_aspect('equal')
    bare(ax)
    ax.set_title('只作用在 $(i,j)$ 平面内的一次旋转', fontweight='bold', fontsize=12)

    # 右：矩阵结构（画成真正的矩阵表格，比热力图好读）
    ax = fig.add_subplot(gs[0, 1])
    m, i, j = 7, 2, 5
    M = np.eye(m)
    c, s = np.cos(np.radians(35)), np.sin(np.radians(35))
    M[i, i], M[i, j] = c, s
    M[j, i], M[j, j] = -s, c
    ax.add_patch(Rectangle((-0.5, -0.5), m, m, facecolor='white',
                           edgecolor='#cbd5e1', lw=1.3, zorder=1))
    ax.add_patch(Rectangle((i - 0.5, i - 0.5), j - i + 1, j - i + 1,
                           facecolor=ORANGE, alpha=0.13, edgecolor='none', zorder=2))
    for a in range(m + 1):
        ax.plot([-0.5, m - 0.5], [a - 0.5, a - 0.5], color='#eef2f7', lw=0.9, zorder=3)
        ax.plot([a - 0.5, a - 0.5], [-0.5, m - 0.5], color='#eef2f7', lw=0.9, zorder=3)
    for a in range(m):
        for b in range(m):
            val = M[a, b]
            if abs(val - 1) < 1e-9:
                ax.text(b, a, '1', ha='center', va='center', fontsize=10, color='#94a3b8', zorder=4)
            elif abs(val) > 1e-9:
                ax.text(b, a, f'{val:.2f}', ha='center', va='center', fontsize=9.4,
                        color='#1f2937', fontweight='bold', zorder=4)
            else:
                ax.text(b, a, '0', ha='center', va='center', fontsize=7.6,
                        color='#d7dee8', zorder=4)
    for (a, b) in [(i, i), (i, j), (j, i), (j, j)]:
        ax.add_patch(Rectangle((b - 0.5, a - 0.5), 1, 1, fill=False,
                               edgecolor=ORANGE, lw=2.4, zorder=5))
    ax.add_patch(Rectangle((i - 0.5, i - 0.5), j - i + 1, j - i + 1, fill=False,
                           edgecolor=ORANGE, lw=1.2, ls='--', zorder=5))
    ax.text(j + 0.85, i, '$c=\\cos\\theta$', color=ORANGE, fontsize=10.5,
            fontweight='bold', va='center')
    ax.text(j + 0.85, j, '$s=\\sin\\theta$', color=ORANGE, fontsize=10.5,
            fontweight='bold', va='center')
    ax.text(-0.6, m + 0.2,
            '$G(i,j,\\theta)$（这里 $n=7$，$i=3$，$j=6$）：单位阵只改 4 个数，其余全是 0 与 1',
            fontsize=11, color='#334155', va='top')
    ax.text(-0.6, m + 1.1,
            '一次旋转只消掉 1 个元素 → 稀疏、天然可并行；\n与 Householder「一次消一片」正好互补。',
            fontsize=10.5, color='#64748b', linespacing=1.5, va='top')
    ax.set_xlim(-0.5, m - 0.5)
    ax.set_ylim(m - 0.5, -0.5)
    bare(ax)
    ax.set_title('$G(i,j,\\theta)$ 的矩阵形状', fontweight='bold', fontsize=12)

    save(fig, os.path.join(CH4, '02_Givens旋转示意.png'))


# ---------------------------------------------------------------- 6. SVD 的几何意义
def fig_svd_geometry():
    def rot(a):
        a = np.radians(a)
        return np.array([[np.cos(a), -np.sin(a)], [np.sin(a), np.cos(a)]])

    V = rot(38)
    U = rot(-24)
    S = np.diag([2.15, 0.68])
    A = U @ S @ V.T

    th = np.linspace(0, 2 * np.pi, 400)
    circle = np.vstack([np.cos(th), np.sin(th)])
    lim = 2.6

    stages = [
        ('① 单位圆', circle, BLUE, '所有单位向量的集合'),
        ('② $V^\\top$：正交变换', V.T @ circle, PURPLE, '圆还是圆，只是转了方向'),
        ('③ $\\Sigma$：沿坐标轴伸缩', S @ V.T @ circle, GREEN, '两个半轴长 = $\\sigma_1,\\sigma_2$'),
        ('④ $U$：再正交变换', A @ circle, ORANGE, '得到 $A$ 作用下的椭圆'),
    ]
    track = [
        ('$v_1$', V[:, 0], None),
        ('$V^\\top v_1 = e_1$', np.array([1.0, 0.0]), None),
        ('$\\sigma_1 e_1$', np.array([2.15, 0.0]), None),
        ('$\\sigma_1 u_1$', A @ V[:, 0], '$\\sigma_1 u_1$'),
    ]
    track2 = [
        ('$v_2$', V[:, 1], None),
        ('$V^\\top v_2 = e_2$', np.array([0.0, 1.0]), None),
        ('$\\sigma_2 e_2$', np.array([0.0, 0.68]), None),
        ('$\\sigma_2 u_2$', A @ V[:, 1], '$\\sigma_2 u_2$'),
    ]

    fig, axes = plt.subplots(1, 4, figsize=(14.6, 3.9))
    for k, ax in enumerate(axes):
        ax.plot([-lim, lim], [0, 0], color=FAINT, lw=1.0)
        ax.plot([0, 0], [-lim, lim], color=FAINT, lw=1.0)
        title, pts, col, note = stages[k]
        ax.fill(pts[0], pts[1], color=col, alpha=0.16)
        ax.plot(pts[0], pts[1], color=col, lw=2.4)
        arrow(ax, (0, 0), tuple(track[k][1]), ORANGE, lw=2.2, z=6)
        arrow(ax, (0, 0), tuple(track2[k][1]), GREEN, lw=1.8, ls='--', z=6)
        if k == 0:
            ax.text(*(track[k][1] + np.array([0.12, 0.08])), '$v_1$', color=ORANGE,
                    fontsize=11, fontweight='bold')
            ax.text(*(track2[k][1] + np.array([-0.20, 0.16])), '$v_2$', color=GREEN,
                    fontsize=11, fontweight='bold')
        elif k == 1:
            ax.text(*(track[k][1] + np.array([0.04, 0.16])), '$e_1$', color=ORANGE,
                    fontsize=11, fontweight='bold')
            ax.text(*(track2[k][1] + np.array([0.16, 0.02])), '$e_2$', color=GREEN,
                    fontsize=11, fontweight='bold')
        elif k == 2:
            ax.text(*(track[k][1] + np.array([-1.85, 0.16])), '$\\sigma_1 e_1$', color=ORANGE,
                    fontsize=11, fontweight='bold')
            ax.text(*(track2[k][1] + np.array([0.16, 0.02])), '$\\sigma_2 e_2$', color=GREEN,
                    fontsize=11, fontweight='bold')
        else:
            ax.text(*(track[k][1] + np.array([0.02, -0.42])), '$\\sigma_1 u_1$', color=ORANGE,
                    fontsize=11, fontweight='bold')
            ax.text(*(track2[k][1] + np.array([0.10, 0.20])), '$\\sigma_2 u_2$', color=GREEN,
                    fontsize=11, fontweight='bold')
        ax.set_xlim(-lim, lim)
        ax.set_ylim(-lim, lim)
        ax.set_aspect('equal')
        bare(ax)
        ax.set_title(title, fontweight='bold', fontsize=11.8)
        ax.text(-lim + 0.06, -lim + 0.18, note, fontsize=9.8, color='#64748b')

    fig.suptitle('SVD 的几何意义：$A = U\\Sigma V^\\top$ —— 旋转 · 沿轴伸缩 · 再旋转'
                 '（对任何矩阵都成立；跟着橘色箭头走一遍 $v_1$ 的去向）',
                 fontsize=13.5, fontweight='bold', y=1.07)
    save(fig, os.path.join(CH4, '03_SVD的几何意义.png'))
    return A, np.linalg.svd(A, compute_uv=False)


# ---------------------------------------------------------------- 7. SVD 图像压缩
def fig_svd_compress():
    n = 240
    y, x = np.mgrid[0:n, 0:n] / (n - 1)
    img = 0.12 + 0.50 * np.exp(-(((x - 0.30) ** 2 + (y - 0.32) ** 2) / 0.055))
    img += 0.44 * ((x > 0.52) & (x < 0.84) & (y > 0.55) & (y < 0.88))
    img += 0.20 * np.sin(13 * np.pi * (x + y)) * (((x + y) > 1.02) & (y < 0.5))
    img += 0.18 * (x * (1 - y))
    img = np.clip(img, 0, 1)

    U, s, Vt = np.linalg.svd(img, full_matrices=False)
    fro = np.linalg.norm(img)

    def recon(k):
        return (U[:, :k] * s[:k]) @ Vt[:k]

    ranks = [5, 15, 40, 80]
    ks = np.arange(1, n + 1)
    errs = np.array([np.linalg.norm(img - recon(int(k))) / fro for k in ks])

    fig = plt.figure(figsize=(14.0, 6.0))
    gs = fig.add_gridspec(2, 5, height_ratios=[1, 0.88], hspace=0.4, wspace=0.1)

    def panel(ax, data, title):
        ax.imshow(data, cmap='gray', vmin=0, vmax=1, aspect='equal')
        ax.set_xticks([])
        ax.set_yticks([])
        ax.set_title(title, fontweight='bold', fontsize=9.9)
        for sp in ax.spines.values():
            sp.set_edgecolor('#cbd5e1')

    ax0 = fig.add_subplot(gs[0, 0])
    panel(ax0, img, f'原图 {n}×{n}　存储 100%')
    for idx, k in enumerate(ranks):
        ax = fig.add_subplot(gs[0, idx + 1])
        keep = k * (2 * n + 1) / (n * n) * 100
        panel(ax, recon(k), f'$k={k}$　存储 {keep:.0f}%　误差 {errs[k - 1] * 100:.1f}%')

    ax = fig.add_subplot(gs[1, :])
    ax.plot(ks, errs * 100, color=BLUE, lw=2.4)
    for k in ranks:
        ax.plot([k], [errs[k - 1] * 100], 'o', color=ORANGE, ms=7, zorder=5)
        ax.annotate(f'$k={k}$：{errs[k - 1] * 100:.1f}%', (k, errs[k - 1] * 100),
                    textcoords='offset points', xytext=(7, 9),
                    fontsize=10, color='#334155')
    ax.set_yscale('log')
    ax.set_xlabel('保留的奇异值个数 $k$')
    ax.set_ylabel('相对误差  $\\|A-A_k\\|_F/\\|A\\|_F$  (%)')
    ax.set_title('纵轴取对数后看得更清楚：误差单调下降 —— 保留的是最大的 $\\sigma$，丢掉的是最小的 $\\sigma$',
                 fontweight='bold', fontsize=12)
    ax.grid(True, which='both', color=FAINT, lw=0.9, ls='--')
    ax.set_xlim(0, n)
    ax.set_ylim(max(0.25, errs.min() * 8), 24)
    ax.text(n * 0.52, errs[ranks[0] - 1] * 100 * 1.5,
            f'$k={ranks[0]}$（只有 {ranks[0] / n * 100:.0f}% 的存储量）误差就降到 '
            f'{errs[ranks[0] - 1] * 100:.1f}%',
            fontsize=10.5, color='#334155')
    ax.text(n * 0.52, errs[ranks[0] - 1] * 100 * 0.72,
            f'$k={ranks[-1]}$ 时只剩 {errs[ranks[-1] - 1] * 100:.1f}%，肉眼已看不出差别',
            fontsize=10.5, color='#334155')

    fig.suptitle('SVD 图像压缩：只留前 $k$ 个奇异值 —— 丢掉的是「小到看不见」的方向',
                 fontsize=13.5, fontweight='bold', y=0.99)
    save(fig, os.path.join(CH4, '04_SVD图像压缩.png'))
    return [(int(k), float(errs[k - 1]) * 100) for k in ranks], float(s[0]), n


def main():
    print('生成矩阵论配图 →')
    fig_linear_map()
    turn, w = fig_eigenvector()
    e12, nw2 = fig_schmidt()
    fig_householder()
    fig_givens()
    A, sv = fig_svd_geometry()
    info, s1, n = fig_svd_compress()
    print(f'\n最大偏转角 {turn:.1f}°，特征值 λ = {w[0]:.2f} / {w[1]:.2f}，'
          f'最大奇异值 {sv[0]:.2f}')
    print(f'Schmidt 校验：e1·e2 = {e12:+.1e}，‖w2‖ = {nw2:.3f}')
    print('图像压缩误差：', ', '.join(f'k={k} → {e:.1f}%' for k, e in info))
    print('完成。')


if __name__ == '__main__':
    main()
