---
name: test-code-generator
description: 基于测试用例文档，设计测试数据并生成符合项目规范的 go test/pytest 测试代码
version: 2.1
---

# 测试代码生成技能

## 概述

基于测试用例文档（testcase.md），完成测试数据设计和测试代码生成，支持：
- **Go语言**：go test 直接调用 Handler 方法（gRPC接口）
- **Python语言**：pytest + TestClient（HTTP API接口）

## 强制约束

1. **依赖前置产物**: 必须基于 testcase.md 文档生成代码
2. **用例一一对应**: testcase.md 中的每个测试用例必须有对应的测试代码
3. **数据完整性**: 测试数据必须覆盖所有测试场景
4. **代码可执行**: 生成的代码必须能直接运行

## 模板文件

| 模板 | 路径 | 适用场景 |
|------|------|----------|
| gRPC测试 | templates/grpc_test_template.md | Go gRPC接口 |
| HTTP测试 | templates/universal_test_template.md | Python HTTP API |

## 实现方法

### 阶段一: 测试数据设计

#### 步骤1: 数据模型分析
- 读取 testcase.md 中的测试用例
- 识别核心业务实体和数据关系
- 分析数据字段类型和格式约束

#### 步骤2: Mock数据设计
- **基础数据**：符合业务规则的基本数据
- **关联数据**：有业务关联关系的数据集合
- **测试专用数据**：专门用于测试的特殊数据

#### 步骤3: 测试参数设计
- **正常参数**：符合接口规范的有效参数
- **异常参数**：各种无效或错误的参数
- **边界参数**：临界值的参数测试
- **安全参数**：用于安全测试的恶意参数

### 阶段二: 测试代码生成

#### 步骤4: 分析现有代码结构
- 查找项目中已有的测试代码
- 识别测试类命名规范
- 了解数据准备和清理模式

#### 步骤5: 生成测试代码
- 根据选定的模板生成测试代码
- 将设计的测试数据嵌入代码
- 确保断言逻辑完整

## 命名规范

### Go语言 (gRPC接口)
| 类型 | 格式 | 示例 |
|------|------|------|
| 文件名 | `{service}_test.go` | `dataflow_test.go` |
| Handler测试 | `Test{Handler}_{Scenario}` | `TestDataFlowWorker_BasicQuery` |
| 场景后缀 | `_NilRequest`, `_Boundary`, `_InvalidInput` | - |

### Python语言 (HTTP API)
| 类型 | 格式 | 示例 |
|------|------|------|
| 文件名 | `test_{module}_router_BVT.py` | `test_risk_list_router_BVT.py` |
| 类名 | `Test{Module}Router` | `TestRiskListRouter` |
| 方法名 | `test_tc_{module}_{func}_{seq}_{desc}` | `test_tc_risk_list_001_normal` |

### pytest 标记
| 标记 | 用途 |
|------|------|
| `@pytest.mark.BVT` | 基础验证测试 |
| `@pytest.mark.Level1` | 异常、边界测试 |
| `@pytest.mark.Level2` | 安全、性能测试 |

## 断言规范

### Go语言
```go
if err != nil {
    t.Fatalf("调用失败: %v", err)
}
if resp.Field != expected {
    t.Errorf("期望 %v, 实际 %v", expected, resp.Field)
}
```

### Python语言
```python
assert response.status_code == 200, f"期望200，实际{response.status_code}"
assert "data" in response_data, "响应应包含data字段"
```

## 输出模板

### Python Mock数据
```python
class MockDataGenerator:
    @staticmethod
    def generate_test_data():
        return {
            "id": "test_001",
            "name": "测试数据",
            "status": 1
        }
```

### Python测试代码
```python
class TestModuleRouter:
    def test_tc_module_func_001_normal(self):
        """测试目标：正常查询功能"""
        response = client.post("/api/xxx", json={"limit": 20})
        assert response.status_code == 200
        assert "total" in response.json()
```

## 常见错误

### 错误1: 测试数据不真实
```text
❌ 错误：name="test123", email="invalid@format"
✅ 正确：name="张三", email="zhangsan@company.com"
```

### 错误2: 用例与代码不对应
```text
❌ 错误：testcase.md 有12个用例，代码只有8个测试函数
✅ 正确：每个测试用例都有对应的测试函数
```

### 错误3: 断言逻辑不完整
```text
❌ 错误：只验证状态码200
✅ 正确：验证状态码 + 返回数据结构 + 关键字段值
```

## 输入输出

### 输入
```json
{
  "testcase_path": "doc/testcase/testcase.md",
  "language": "python|go",
  "output_path": "testing/tests/"
}
```

### 输出
1. 测试数据文件（mock_data.py 或 test_data.go）
2. 测试代码文件（test_xxx.py 或 xxx_test.go）

## 数据设计原则

| 原则 | 说明 |
|------|------|
| 真实性 | 数据符合实际业务场景 |
| 覆盖性 | 覆盖所有测试场景和边界条件 |
| 独立性 | 每个测试用例的数据相互独立 |
| 可维护性 | 数据模板易于修改和扩展 |

## 注意事项

1. **遵循项目规范**：严格遵循现有代码风格和命名规范
2. **测试数据隔离**：使用独立的测试数据，避免影响其他测试
3. **错误处理**：确保测试能优雅处理预期外的错误
4. **CI/CD兼容**：确保测试在CI/CD环境中能正常运行
