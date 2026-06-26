# Python通用测试代码模板

## 1. 基础测试类模板 (API接口测试)

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# @File     : test_module_name.py
# @Date     : {date}
# @Function : {module_description}相关单元测试
# @Author   : {author}

import pytest
import logging
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from unittest.mock import Mock, patch

# 项目相关导入 (需要根据具体项目调整)
from your_project.db import open_session
from your_project.run import app
from your_project.models import YourModel

# 初始化测试客户端
client = TestClient(app, base_url='https://testserver')


class TestModuleName:
    """测试类命名规范：Test + 模块名称"""

    def setup_class(self):
        """类级别的测试前设置，只在类中所有测试方法执行前运行一次"""
        # 初始化类级别的资源
        # 例如：数据库连接、配置加载等
        pass

    def teardown_class(self):
        """类级别的测试后清理，只在类中所有测试方法执行后运行一次"""
        # 清理类级别的资源
        pass

    def setup_method(self):
        """方法级别的测试前设置，每个测试方法执行前都会运行"""
        # 清理测试数据，确保测试环境干净
        with open_session() as session:
            # 清理相关测试数据
            YourTestModel.delete(session)
            session.commit()

    def teardown_method(self):
        """方法级别的测试后清理，每个测试方法执行后都会运行"""
        # 清理测试数据
        with open_session() as session:
            # 清理相关测试数据
            YourTestModel.delete(session)
            session.commit()

    @pytest.mark.BVT  # 测试级别标记：BVT(基础验证测试)、Level1、Level2等
    @pytest.mark.{author_name}  # 作者标记
    @pytest.mark.{test_type}  # 测试类型标记：单接口、集成测试等
    @pytest.mark.{version_tag}  # 版本标记
    def test_tc_{module_code}_{function_code}_{sequence_number}(self):
        """
        测试用例命名规范：test_tc_模块代码_功能代码_序号

        测试目标：{test_description}
        前置条件：
        1. {condition_1}
        2. {condition_2}

        测试步骤：
        1. {step_1}
        2. {step_2}

        期望结果：
        1. {expected_result_1}
        2. {expected_result_2}
        """
        # ===== 数据准备阶段 =====
        with open_session() as session:
            # 创建测试数据
            UnitTestPrebuildTool.create_test_data(
                session,
                param1=value1,
                param2=value2
            )
            session.commit()

        # ===== 测试执行阶段 =====
        # 准备请求参数
        request_params = {
            "param1": "value1",
            "param2": "value2"
        }

        # 发送请求
        response = client.get(
            "/api/endpoint",
            params=request_params
        )

        # ===== 结果验证阶段 =====
        # 1. 验证HTTP状态码
        assert response.status_code == 200

        # 2. 验证响应数据结构
        data = response.json()
        assert "code" in data
        assert "data" in data

        # 3. 验证业务逻辑
        assert data["code"] == 0
        assert data["data"]["expected_field"] == expected_value

        # 4. 验证数据完整性
        if "total" in data["data"]:
            assert data["data"]["total"] == expected_count

    @pytest.mark.Level1
    def test_tc_{module_code}_{function_code}_{sequence_number}_edge_case(self):
        """
        边界条件测试

        测试目标：{test_description}
        边界条件：
        1. {edge_condition_1}
        2. {edge_condition_2}
        """
        # 测试空参数
        response = client.get("/api/endpoint", params={"param": ""})
        assert response.status_code == 400  # 期望返回错误

        # 测试异常参数
        response = client.get("/api/endpoint", params={"param": "invalid_value"})
        assert response.status_code == 400

    @pytest.mark.Level2
    def test_tc_{module_code}_{function_code}_{sequence_number}_exception_case(self):
        """
        异常情况测试

        测试目标：{test_description}
        异常情况：
        1. {exception_condition_1}
        2. {exception_condition_2}
        """
        # 模拟异常情况
        with patch('your_project.module.function', side_effect=Exception("Mocked error")):
            response = client.get("/api/endpoint")
            assert response.status_code == 500
```

## 2. Model单元测试模板

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# @File     : test_model_name.py
# @Date     : {date}
# @Function : 测试 {ModelName} 模型方法
# @Author   : {author}

import pytest
import json
from unittest.mock import Mock, patch, MagicMock
from sqlalchemy.orm import Session

from your_project.models.module.model_name import ModelName
from your_project.schemas.module import ResponseSchema


class TestModelName:
    """测试类命名规范：Test + 模型名称"""

    def setup_method(self):
        """测试前设置"""
        self.mock_session = Mock(spec=Session)
        self.mock_model = Mock()

    def test_{model_method}_normal_case(self):
        """
        测试 {ModelName.{method_name}} 方法
        正常情况：{normal_case_description}
        """
        # 模拟输入数据
        input_data = {
            "field1": "value1",
            "field2": "value2"
        }

        # 模拟返回数据
        expected_result = {
            "id": 1,
            "status": "success",
            "data": input_data
        }

        # 模拟依赖方法
        with patch.object(ModelName, 'dependency_method', return_value=expected_result) as mock_dependency:
            # 调用目标方法
            result = ModelName.target_method(
                session=self.mock_session,
                model=self.mock_model,
                **input_data
            )

            # 验证依赖方法被正确调用
            mock_dependency.assert_called_once_with(
                db=self.mock_session,
                model=self.mock_model,
                **input_data
            )

            # 验证返回结果
            assert isinstance(result, ResponseSchema)
            assert result.status == "success"
            assert result.data == input_data

    def test_{model_method}_empty_data(self):
        """
        测试 {ModelName.{method_name}} 方法
        边界情况：{boundary_case_description}
        """
        # 模拟边界情况数据
        with patch.object(ModelName, 'dependency_method', return_value=[]) as mock_dependency:
            result = ModelName.target_method(
                session=self.mock_session,
                model=self.mock_model
            )

            # 验证边界情况处理
            assert isinstance(result, ResponseSchema)
            assert result.count == 0
            assert result.data == []

    def test_{model_method}_exception_case(self):
        """
        测试 {ModelName.{method_name}} 方法
        异常情况：{exception_case_description}
        """
        # 模拟异常
        with patch.object(ModelName, 'dependency_method', side_effect=Exception("Database error")) as mock_dependency:
            # 验证异常处理
            with pytest.raises(Exception, match="Database error"):
                ModelName.target_method(
                    session=self.mock_session,
                    model=self.mock_model
                )

    def test_{model_method}_partial_fields(self):
        """
        测试 {ModelName.{method_name}} 方法
        边界情况：部分字段为空
        """
        # 模拟部分字段为空的数据
        partial_data = {
            "field1": "value1",
            "field2": None,
            "field3": ""
        }

        with patch.object(ModelName, 'dependency_method', return_value=partial_data) as mock_dependency:
            result = ModelName.target_method(
                session=self.mock_session,
                model=self.mock_model
            )

            # 验证部分字段为空的处理
            assert result.field1 == "value1"
            assert result.field2 is None
            assert result.field3 == ""
```

## 3. 数据构造工具模板

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# @File     : unit_test_prebuild_tool.py
# @Date     : {date}
# @Function : 单测前置条件构造工具
# @Author   : {author}

import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

from testing.utils.build_time import TimeBuilder
from testing.test_model.dspm.your_test_model import YourTestModel


class UnitTestPrebuildTool:
    """单测数据构造工具类"""

    @staticmethod
    def create_test_data(session, *,
                        timestamp=TimeBuilder.get_interview_today_hour(0),
                        name="默认测试数据",
                        field1="default_value1",
                        field2="default_value2",
                        status=1,
                        **kwargs):
        """
        创建一条测试数据

        Args:
            session: 数据库会话
            timestamp: 时间戳
            name: 数据名称
            field1: 字段1默认值
            field2: 字段2默认值
            status: 状态
            **kwargs: 其他字段
        """
        test_data_info = {
            # 必填字段
            "id": str(uuid.uuid4()),
            "name": name,
            "createTime": timestamp,
            "updateTime": timestamp,
            "status": status,
            # 业务字段
            "field1": field1,
            "field2": field2,
            # 可选字段
            **kwargs
        }

        YourTestModel.create(session, test_data_info)

    @staticmethod
    def create_batch_test_data(session, count: int, **kwargs):
        """
        批量创建测试数据

        Args:
            session: 数据库会话
            count: 创建数量
            **kwargs: 数据字段参数
        """
        for i in range(count):
            UnitTestPrebuildTool.create_test_data(
                session,
                name=f"测试数据_{i+1}",
                **kwargs
            )

    @staticmethod
    def clean_test_data(session):
        """清理测试数据"""
        YourTestModel.delete(session)
```

## 4. 时间构造工具模板

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# @File     : build_time.py
# @Date     : {date}
# @Function : 测试时间构造工具
# @Author   : {author}

import time
from datetime import datetime, timedelta
from typing import Tuple


class TimeBuilder:
    """测试时间构造工具类"""

    @staticmethod
    def get_current_timestamp() -> int:
        """获取当前时间戳"""
        return int(time.time())

    @staticmethod
    def get_interview_today_hour(hour: int = 0) -> int:
        """获取今天指定小时的时间戳"""
        now = datetime.now()
        return int(datetime(
            now.year, now.month, now.day, hour, 0, 0
        ).timestamp())

    @staticmethod
    def get_interview_before_days(days: int) -> int:
        """获取N天前的时间戳"""
        return int((datetime.now() - timedelta(days=days)).timestamp())

    def get_interview_before_7() -> int:
        """获取7天前的时间戳"""
        return TimeBuilder.get_interview_before_days(7)

    def get_interview_before_30() -> int:
        """获取30天前的时间戳"""
        return TimeBuilder.get_interview_before_days(30)

    @staticmethod
    def get_scope_today() -> Tuple[int, int]:
        """获取今天的时间范围"""
        start_time = TimeBuilder.get_interview_today_hour(0)
        end_time = TimeBuilder.get_interview_today_hour(23, 59, 59)
        return start_time, end_time

    @staticmethod
    def get_interview_today_hour(hour: int, minute: int = 0, second: int = 0) -> int:
        """获取今天指定时分秒的时间戳"""
        now = datetime.now()
        return int(datetime(
            now.year, now.month, now.day, hour, minute, second
        ).timestamp())
```

## 5. 测试数据模型模板

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# @File     : your_test_model.py
# @Date     : {date}
# @Function : 测试数据模型
# @Author   : {author}

from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional


class YourTestModel:
    """测试数据模型类"""

    @staticmethod
    def create(session: Session, data: Dict[str, Any]):
        """
        创建测试数据记录

        Args:
            session: 数据库会话
            data: 数据字典
        """
        # 实现具体的数据创建逻辑
        # 这里需要根据实际的数据模型进行调整
        pass

    @staticmethod
    def delete(session: Session, conditions: Optional[Dict[str, Any]] = None):
        """
        删除测试数据记录

        Args:
            session: 数据库会话
            conditions: 删除条件，为空时删除所有
        """
        # 实现具体的数据删除逻辑
        pass

    @staticmethod
    def find_one(session: Session, conditions: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        查找单条测试数据记录

        Args:
            session: 数据库会话
            conditions: 查询条件

        Returns:
            查询到的数据记录，未找到时返回None
        """
        # 实现具体的数据查找逻辑
        pass

    @staticmethod
    def find_all(session: Session, conditions: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        查找多条测试数据记录

        Args:
            session: 数据库会话
            conditions: 查询条件，为空时查询所有

        Returns:
            查询到的数据记录列表
        """
        # 实现具体的数据查找逻辑
        pass
```

## 6. 配套配置文件

### pytest.ini
```ini
[tool:pytest]
testpaths = testing
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = -v --tb=short --strict-markers
markers =
    单接口: 单接口测试
```

### requirements-test.txt
```txt
# 测试依赖
pytest>=7.0.0
pytest-asyncio>=0.21.0
pytest-html>=3.1.1
pytest-cov>=4.0.0
pytest-mock>=3.10.0
fastapi[all]>=0.100.0
httpx>=0.24.0
sqlalchemy>=2.0.0
```

## 使用说明

### 1. 项目结构调整
```
your_project/
├── testing/
│   ├── test_model/
│   │   ├── __init__.py
│   │   └── {module}/
│   │       ├── __init__.py
│   │       └── {test_models}.py
│   ├── test_router/
│   │   ├── __init__.py
│   │   └── test_{router_name}.py
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── unit_test_prebuild_tool.py
│   │   └── build_time.py
│   └── data_template/
│       ├── data_template_file.py
│       └── data/
```

### 2. 测试用例命名规范
- **测试类**：`TestModuleName` (大驼峰)
- **测试方法**：`test_tc_module_function_sequence` (下划线分隔)
- **测试标记**：使用`@pytest.mark`装饰器标记测试级别、作者、类型等

### 3. 数据准备和清理
- 使用`setup_method`和`teardown_method`确保每个测试用例的环境干净
- 使用`UnitTestPrebuildTool`构造标准化的测试数据
- 使用`TimeBuilder`构造测试所需的时间数据

### 4. 测试验证要点
- HTTP状态码验证
- 响应数据结构验证
- 业务逻辑正确性验证
- 数据完整性验证
- 异常情况处理验证

这套模板具有良好的可移植性和可扩展性，可以根据不同项目的具体需求进行调整和扩展。