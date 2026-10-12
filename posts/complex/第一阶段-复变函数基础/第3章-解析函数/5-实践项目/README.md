# 解析函数分析器 (Analytic Function Analyzer)

## 项目目的

本项目是第3章"解析函数"的实践项目，通过数值计算验证柯西-黎曼（C-R）方程，分析函数的解析性。

研究以下3个函数：
1. **f(z) = z²**
2. **f(z) = e^z**
3. **f(z) = 1/z**

## 使用方法

```bash
cd "第一阶段-复变函数基础/第3章-解析函数/5-实践项目"
python3 analytic_analyzer.py
```

运行后会自动生成：
- `report.txt`：详细的分析报告
- `chapter3_f(z)=z2_contour.png`：z² 的u和v等高线图
- `chapter3_f(z)=z2_cr_histogram.png`：z² 的C-R误差分布直方图
- `chapter3_f(z)=e^z_contour.png`：e^z 的u和v等高线图
- `chapter3_f(z)=e^z_cr_histogram.png`：e^z 的C-R误差分布直方图
- `chapter3_f(z)=1/z_contour.png`：1/z 的u和v等高线图
- `chapter3_f(z)=1/z_cr_histogram.png`：1/z 的C-R误差分布直方图

## 代码逻辑

- **数值偏导数**：使用有限差分法计算 ∂u/∂x, ∂u/∂y, ∂v/∂x, ∂v/∂y
- **C-R方程验证**：在每个网格点检查 u_x = v_y 和 u_y = -v_x 是否成立
- **调和函数验证**：计算拉普拉斯算子 ∇²u 和 ∇²v，验证调和性
- **共轭调和函数**：验证 u 和 v 的梯度正交性（∇u · ∇v = 0）
- **可视化**：绘制 u(x,y) 和 v(x,y) 的等高线图，观察正交性

## 结果分析

1. **f(z) = z²**：在整个复平面上解析，C-R方程处处成立。u = x² - y², v = 2xy，等高线呈双曲线族。
2. **f(z) = e^z**：在整个复平面上解析。u = e^x cos y, v = e^x sin y，等高线呈指数型分布。
3. **f(z) = 1/z**：除 z=0 外在所有点解析。在 z=0 处有奇点，C-R方程在该点不成立。
4. 对于解析函数，实部 u 和虚部 v 都是调和函数（满足拉普拉斯方程），且互为共轭调和函数（等高线正交）。