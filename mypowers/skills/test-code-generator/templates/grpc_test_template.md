# gRPC接口测试代码模板

## Go语言 gRPC接口测试模板（推荐）

> 基于 grpc-service-framework 项目的实际测试代码，直接调用 Handler 方法进行测试，无需启动 gRPC 服务。

### 1. Go gRPC测试基础模板

```go
// Package {package_name} 接口测试
// @File     : {service_name}_test.go
// @Date     : {date}
// @Function : {ServiceName}Service 接口测试
package {package_name}

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"code.example.org/ADS/DSP/Platform/grpc-service-framework/utils/postgresql_util"
	util_registry "code.example.org/ADS/DSP/Platform/grpc-service-framework/utils/util_registry"
	pb "code.example.org/ADS/DSP/Platform/grpc-service-framework/proto/{proto_package}"
)

// TestMain 测试入口，初始化数据库连接
func TestMain(m *testing.M) {
	// 设置PostgreSQL环境变量（CI/CD环境默认值）
	if os.Getenv("PG_HOST") == "" {
		os.Setenv("PG_HOST", "postgres")
	}
	if os.Getenv("PG_PORT") == "" {
		os.Setenv("PG_PORT", "5432")
	}
	if os.Getenv("PG_USER") == "" {
		os.Setenv("PG_USER", "admin")
	}
	if os.Getenv("PG_PASSWORD") == "" {
		os.Setenv("PG_PASSWORD", "")
	}

	// 注册并初始化PostgreSQL插件
	postgresql_util.InitPlugin()
	ctx := context.Background()
	_ = util_registry.InitUtil(ctx)

	// 运行测试
	code := m.Run()

	os.Exit(code)
}

// 创建测试用的Handler实例
func newTestHandler(t *testing.T) *{HandlerType} {
	handler := &{HandlerType}{}
	// 初始化必要的字段
	// handler.field = initValue
	return handler
}
```

### 2. 服务信息测试模板

```go
// Test{ServerType}_Info 服务信息测试
func Test{ServerType}_Info(t *testing.T) {
	server := &{ServerType}{}
	info := server.Info()
	if info == "" {
		t.Fatal("服务信息不应为空")
	}
	t.Logf("服务信息: %s", info)
}
```

### 3. Handler方法测试模板 - 空请求测试

```go
// Test{HandlerType}_{MethodName}_NilRequest 空请求测试
func Test{HandlerType}_{MethodName}_NilRequest(t *testing.T) {
	handler := newTestHandler(t)
	resp, err := handler.{MethodName}(nil)
	if err == nil {
		t.Fatal("空请求应返回错误")
	}
	if resp != nil {
		t.Fatal("空请求响应应为nil")
	}
	t.Logf("空请求正确返回错误: %v", err)
}
```

### 4. Handler方法测试模板 - 空结构请求测试

```go
// Test{HandlerType}_{MethodName}_EmptyRequest 空结构请求测试
func Test{HandlerType}_{MethodName}_EmptyRequest(t *testing.T) {
	handler := newTestHandler(t)
	req := &pb.RequestMsg{}
	resp, err := handler.{MethodName}(req)
	if err != nil {
		t.Fatalf("空结构请求调用失败: %v", err)
	}
	t.Logf("空结构请求响应: Field1=%v", resp.Field1)
}
```

### 5. Handler方法测试模板 - 基础查询测试

```go
// Test{HandlerType}_{MethodName}_BasicQuery 基础查询测试
func Test{HandlerType}_{MethodName}_BasicQuery(t *testing.T) {
	handler := newTestHandler(t)
	req := &pb.RequestMsg{
		Field1: "test_value",
		Field2: 123,
		// 根据实际proto定义填充字段
	}
	resp, err := handler.{MethodName}(req)
	if err != nil {
		t.Fatalf("{MethodName}调用失败: %v", err)
	}
	if resp == nil {
		t.Fatal("响应不应为nil")
	}
	t.Logf("响应: Field1=%v, Field2=%d", resp.Field1, resp.Field2)
}
```

### 6. 子测试模板 - 参数变化测试

```go
// Test{HandlerType}_{MethodName}_Different{ParamName}s 不同{ParamName}测试
func Test{HandlerType}_{MethodName}_Different{ParamName}s(t *testing.T) {
	handler := newTestHandler(t)
	testCases := []string{"value1", "value2", "value3", "value4", "value5"}

	for _, tc := range testCases {
		t.Run("{ParamName}_"+tc, func(t *testing.T) {
			req := &pb.RequestMsg{
				{ParamName}: tc,
			}
			resp, err := handler.{MethodName}(req)
			if err != nil {
				t.Errorf("{ParamName} %s 调用失败: %v", tc, err)
				return
			}
			t.Logf("{ParamName} %s 响应: Result=%v", tc, resp.Result)
		})
	}
}
```

### 7. 服务端方法测试模板（gRPC Server方法）

```go
// Test{ServerType}_{ServiceMethod} 服务端方法测试
func Test{ServerType}_{ServiceMethod}(t *testing.T) {
	server := &{ServerType}{}
	server.handler = newTestHandler(t)

	req := &pb.RequestMsg{
		Field1: "test_value",
		Field2: 123,
	}

	ctx := context.Background()
	resp, err := server.{ServiceMethod}(ctx, req)
	if err != nil {
		t.Fatalf("{ServiceMethod}调用失败: %v", err)
	}
	if resp == nil {
		t.Fatal("响应不应为nil")
	}
	t.Logf("服务端方法响应: Field1=%v, Field2=%d", resp.Field1, resp.Field2)
}
```

### 8. 边界条件测试模板

```go
// Test{HandlerType}_{MethodName}_Boundary 边界条件测试
func Test{HandlerType}_{MethodName}_Boundary(t *testing.T) {
	handler := newTestHandler(t)

	testCases := []struct {
		name     string
		input    string
		expected bool
	}{
		{"边界值1", "boundary_value_1", true},
		{"边界值2", "boundary_value_2", false},
		{"空值", "", false},
		{"最大值", "max_value", true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := &pb.RequestMsg{
				Field1: tc.input,
			}

			resp, err := handler.{MethodName}(req)
			if err != nil {
				t.Fatalf("{MethodName}调用失败: %v", err)
			}

			if resp.Result != tc.expected {
				t.Errorf("边界测试 %s 期望=%v, 实际=%v", tc.name, tc.expected, resp.Result)
			}

			t.Logf("边界测试 %s: Result=%v (期望=%v)", tc.name, resp.Result, tc.expected)
		})
	}
}
```

### 9. 无效输入测试模板

```go
// Test{HandlerType}_{MethodName}_InvalidInput 无效输入测试
func Test{HandlerType}_{MethodName}_InvalidInput(t *testing.T) {
	handler := newTestHandler(t)

	invalidInputs := []string{
		"invalid_format",
		"too_long_value_exceeds_limit",
		"special!@#$%chars",
	}

	for _, input := range invalidInputs {
		t.Run("InvalidInput_"+input, func(t *testing.T) {
			req := &pb.RequestMsg{Field1: input}

			resp, err := handler.{MethodName}(req)
			if err != nil {
				t.Logf("无效输入 %s 返回错误(可接受): %v", input, err)
				return
			}

			// 无效输入应该返回默认/错误状态
			t.Logf("无效输入 %s 响应: Result=%v", input, resp.Result)
		})
	}
}
```

---

## 完整示例：DataFlow服务测试

```go
// Package dataflow 接口测试
// @File     : dataflow_test.go
// @Date     : 2025-12-21
// @Function : DataFlowService 接口测试
package dataflow

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"code.example.org/ADS/DSP/Platform/grpc-service-framework/utils/postgresql_util"
	util_registry "code.example.org/ADS/DSP/Platform/grpc-service-framework/utils/util_registry"
	pb "code.example.org/ADS/DSP/Platform/grpc-service-framework/proto/dataflow"
)

// TestMain 测试入口，初始化数据库连接
func TestMain(m *testing.M) {
	// 设置PostgreSQL环境变量（CI/CD环境默认值）
	if os.Getenv("PG_HOST") == "" {
		os.Setenv("PG_HOST", "postgres")
	}
	if os.Getenv("PG_PORT") == "" {
		os.Setenv("PG_PORT", "5432")
	}
	if os.Getenv("PG_USER") == "" {
		os.Setenv("PG_USER", "admin")
	}
	if os.Getenv("PG_PASSWORD") == "" {
		os.Setenv("PG_PASSWORD", "")
	}

	// 注册并初始化PostgreSQL插件
	postgresql_util.InitPlugin()
	ctx := context.Background()
	_ = util_registry.InitUtil(ctx)

	// 运行测试
	code := m.Run()

	os.Exit(code)
}

// 创建测试用的DataFlow实例
func newTestDataFlow(t *testing.T) *DataFlow {
	df := &DataFlow{}
	df.cache = &DataFlowCache{}

	testLifeWindow := 5 * time.Minute
	testMaxNum := 100
	testMaxSize := 10

	var err error
	df.cache.Classifications, err = NewBigCache(testLifeWindow, testMaxNum, testMaxSize, ClassificationCache{})
	if err != nil {
		t.Fatalf("Failed to create Classifications cache: %v", err)
	}

	df.cache.Label, err = NewBigCache(testLifeWindow, testMaxNum, testMaxSize, LabelCache{})
	if err != nil {
		t.Fatalf("Failed to create Label cache: %v", err)
	}

	df.cache.DataSource, err = NewBigCache(testLifeWindow, testMaxNum, testMaxSize, DataSourceCache{})
	if err != nil {
		t.Fatalf("Failed to create DataSource cache: %v", err)
	}

	df.cache.DataTable, err = NewBigCache(testLifeWindow, testMaxNum, testMaxSize, DataTableCache{})
	if err != nil {
		t.Fatalf("Failed to create DataTable cache: %v", err)
	}

	// 设置敏感阈值，避免访问数据库
	df.cache.SensitiveThreshold = 3

	// 初始化dbh，避免空指针
	df.cache.dbh = dbHandle{}

	return df
}

// TestDFServer_Info 服务信息测试
func TestDFServer_Info(t *testing.T) {
	server := &DFServer{}
	info := server.Info()
	if info == "" {
		t.Fatal("服务信息不应为空")
	}
	t.Logf("服务信息: %s", info)
}

// TestDataFlowWorker_NilRequest 空请求测试
func TestDataFlowWorker_NilRequest(t *testing.T) {
	df := newTestDataFlow(t)
	resp, err := df.worker(nil)
	if err == nil {
		t.Fatal("空请求应返回错误")
	}
	if resp != nil {
		t.Fatal("空请求响应应为nil")
	}
	t.Logf("空请求正确返回错误: %v", err)
}

// TestDataFlowWorker_EmptyRequest 空结构请求测试
func TestDataFlowWorker_EmptyRequest(t *testing.T) {
	df := newTestDataFlow(t)
	req := &pb.RequestMsg{}
	resp, err := df.worker(req)
	if err != nil {
		t.Fatalf("空结构请求调用失败: %v", err)
	}
	t.Logf("空结构请求响应: IsSensitive=%v", resp.IsSensitive)
}

// TestDataFlowWorker_BasicQuery 基础查询测试
func TestDataFlowWorker_BasicQuery(t *testing.T) {
	df := newTestDataFlow(t)
	req := &pb.RequestMsg{
		DstIp:   "192.168.1.100",
		DstPort: 3306,
		DbType:  "mysql",
		OprCmd:  "SELECT * FROM users",
		OprObject: []*pb.DatabaseQueryInfo{
			{
				Database:   "test_db",
				ObjectType: "TABLE",
				Schema:     "public",
				ObjectInfo: []*pb.ObjectInfoItem{
					{
						ObjectName:     "users",
						SubObjectNames: []string{"id", "name", "email"},
					},
				},
			},
		},
	}
	resp, err := df.worker(req)
	if err != nil {
		t.Fatalf("worker调用失败: %v", err)
	}
	if resp == nil {
		t.Fatal("响应不应为nil")
	}
	t.Logf("响应: IsSensitive=%v, RespDataGrade=%d", resp.IsSensitive, resp.RespDataGrade)
}

// TestDataFlowWorker_DifferentDbTypes 不同数据库类型测试
func TestDataFlowWorker_DifferentDbTypes(t *testing.T) {
	df := newTestDataFlow(t)
	dbTypes := []string{"mysql", "postgresql", "oracle", "sqlserver", "mongodb"}
	for _, dbType := range dbTypes {
		t.Run("DbType_"+dbType, func(t *testing.T) {
			req := &pb.RequestMsg{
				DstIp:   "192.168.1.100",
				DstPort: 3306,
				DbType:  dbType,
				OprCmd:  "SELECT * FROM test_table",
				OprObject: []*pb.DatabaseQueryInfo{
					{
						Database:   "test_db",
						ObjectType: "TABLE",
						ObjectInfo: []*pb.ObjectInfoItem{
							{
								ObjectName:     "test_table",
								SubObjectNames: []string{"col1", "col2"},
							},
						},
					},
				},
			}
			resp, err := df.worker(req)
			if err != nil {
				t.Errorf("DbType %s 调用失败: %v", dbType, err)
				return
			}
			t.Logf("DbType %s 响应: IsSensitive=%v", dbType, resp.IsSensitive)
		})
	}
}

// TestDataFlowWorker_DifferentPorts 不同端口测试
func TestDataFlowWorker_DifferentPorts(t *testing.T) {
	df := newTestDataFlow(t)
	ports := []int32{3306, 5432, 1521, 1433, 27017}
	for _, port := range ports {
		testName := fmt.Sprintf("Port_%d", port)
		t.Run(testName, func(t *testing.T) {
			req := &pb.RequestMsg{
				DstIp:   "192.168.1.100",
				DstPort: port,
				DbType:  "mysql",
				OprCmd:  "SELECT 1",
			}
			resp, err := df.worker(req)
			if err != nil {
				t.Errorf("Port %d 调用失败: %v", port, err)
				return
			}
			t.Logf("Port %d 响应: IsSensitive=%v", port, resp.IsSensitive)
		})
	}
}

// TestDFServer_DataFlowEnrich 服务端方法测试
func TestDFServer_DataFlowEnrich(t *testing.T) {
	server := &DFServer{}
	server.dataflow = newTestDataFlow(t)
	req := &pb.RequestMsg{
		DstIp:   "192.168.1.100",
		DstPort: 3306,
		DbType:  "mysql",
		OprCmd:  "SELECT * FROM users",
	}
	ctx := context.Background()
	resp, err := server.DataFlowEnrich(ctx, req)
	if err != nil {
		t.Fatalf("DataFlowEnrich调用失败: %v", err)
	}
	if resp == nil {
		t.Fatal("响应不应为nil")
	}
	t.Logf("服务端方法响应: IsSensitive=%v, RespDataGrade=%d", resp.IsSensitive, resp.RespDataGrade)
}
```

---

## 完整示例：SrcIpInfo服务测试（无数据库依赖）

```go
// Package SrcIpInfoEnrich 接口测试
// @File     : src_ip_info_test.go
// @Date     : 2025-12-21
// @Function : SrcIpInfoService 接口测试 - 直接调用Handler方法
package SrcIpInfoEnrich

import (
	"context"
	"math/big"
	"testing"

	"code.example.org/ADS/DSP/Platform/grpc-service-framework/proto/src_ip_info"
)

// 创建测试用的SrcIpInfoHandler实例
func newTestHandler() *SrcIpInfoHandler {
	handler := &SrcIpInfoHandler{}
	// 初始化空的ipGroups，不依赖数据库
	handler.ipGroups = []IpRangeConfig{}
	return handler
}

// 创建带有内网IP配置的测试Handler
func newTestHandlerWithInternalIPs() *SrcIpInfoHandler {
	handler := &SrcIpInfoHandler{}

	// 配置10.0.0.0/8网段
	start10, _ := new(big.Int).SetString("167772160", 10)   // 10.0.0.0
	end10, _ := new(big.Int).SetString("184549375", 10)     // 10.255.255.255

	// 配置172.16.0.0/12网段
	start172, _ := new(big.Int).SetString("2886729728", 10) // 172.16.0.0
	end172, _ := new(big.Int).SetString("2887778303", 10)   // 172.31.255.255

	// 配置192.168.0.0/16网段
	start192, _ := new(big.Int).SetString("3232235520", 10) // 192.168.0.0
	end192, _ := new(big.Int).SetString("3232301055", 10)   // 192.168.255.255

	handler.ipGroups = []IpRangeConfig{
		{
			ipv4Range: []IPRange{
				{start: start10, end: end10},
				{start: start172, end: end172},
				{start: start192, end: end192},
			},
			userGroupId: 100,
		},
	}
	return handler
}

// TestSrcIpInfoHandler_Enrich_EmptyIP 空IP测试
func TestSrcIpInfoHandler_Enrich_EmptyIP(t *testing.T) {
	handler := newTestHandler()

	req := &src_ip_info.RequestMsg{SrcIp: ""}

	resp, err := handler.Enrich(req)
	if err != nil {
		t.Fatalf("Enrich调用失败: %v", err)
	}

	// 空IP应该返回外网标识
	if resp.SrcIpTag != ExternalIp {
		t.Errorf("空IP应返回外网标识, got SrcIpTag=%d", resp.SrcIpTag)
	}

	t.Logf("空IP响应: SrcIpTag=%d, UsergroupId=%d", resp.SrcIpTag, resp.UsergroupId)
}

// TestSrcIpInfoHandler_Enrich_ExternalIP 外网IP测试
func TestSrcIpInfoHandler_Enrich_ExternalIP(t *testing.T) {
	handler := newTestHandlerWithInternalIPs()

	externalIPs := []string{
		"8.8.8.8",
		"114.114.114.114",
		"223.5.5.5",
		"1.1.1.1",
	}

	for _, ip := range externalIPs {
		t.Run("ExternalIP_"+ip, func(t *testing.T) {
			req := &src_ip_info.RequestMsg{SrcIp: ip}

			resp, err := handler.Enrich(req)
			if err != nil {
				t.Fatalf("Enrich调用失败: %v", err)
			}

			if resp.SrcIpTag != ExternalIp {
				t.Errorf("外网IP %s 应返回外网标识, got SrcIpTag=%d", ip, resp.SrcIpTag)
			}

			t.Logf("IP %s: SrcIpTag=%d, UsergroupId=%d", ip, resp.SrcIpTag, resp.UsergroupId)
		})
	}
}

// TestSrcIpInfoHandler_Enrich_InternalIP_10Network 10.x.x.x内网IP测试
func TestSrcIpInfoHandler_Enrich_InternalIP_10Network(t *testing.T) {
	handler := newTestHandlerWithInternalIPs()

	internalIPs := []string{
		"10.0.0.1",
		"10.72.6.100",
		"10.255.255.255",
	}

	for _, ip := range internalIPs {
		t.Run("InternalIP_"+ip, func(t *testing.T) {
			req := &src_ip_info.RequestMsg{SrcIp: ip}

			resp, err := handler.Enrich(req)
			if err != nil {
				t.Fatalf("Enrich调用失败: %v", err)
			}

			if resp.SrcIpTag != InternalIp {
				t.Errorf("内网IP %s 应返回内网标识, got SrcIpTag=%d", ip, resp.SrcIpTag)
			}

			t.Logf("IP %s: SrcIpTag=%d, UsergroupId=%d", ip, resp.SrcIpTag, resp.UsergroupId)
		})
	}
}

// TestSrcIpInfoHandler_Enrich_BoundaryIP 边界IP测试
func TestSrcIpInfoHandler_Enrich_BoundaryIP(t *testing.T) {
	handler := newTestHandlerWithInternalIPs()

	testCases := []struct {
		ip         string
		isInternal bool
	}{
		{"9.255.255.255", false},   // 10.x.x.x 边界外
		{"10.0.0.0", true},         // 10.x.x.x 边界
		{"10.255.255.255", true},   // 10.x.x.x 边界
		{"11.0.0.0", false},        // 10.x.x.x 边界外
		{"172.15.255.255", false},  // 172.16.x.x 边界外
		{"172.16.0.0", true},       // 172.16.x.x 边界
		{"172.31.255.255", true},   // 172.31.x.x 边界
		{"172.32.0.0", false},      // 172.31.x.x 边界外
		{"192.167.255.255", false}, // 192.168.x.x 边界外
		{"192.168.0.0", true},      // 192.168.x.x 边界
		{"192.168.255.255", true},  // 192.168.x.x 边界
		{"192.169.0.0", false},     // 192.168.x.x 边界外
	}

	for _, tc := range testCases {
		t.Run("BoundaryIP_"+tc.ip, func(t *testing.T) {
			req := &src_ip_info.RequestMsg{SrcIp: tc.ip}

			resp, err := handler.Enrich(req)
			if err != nil {
				t.Fatalf("Enrich调用失败: %v", err)
			}

			expectedTag := ExternalIp
			if tc.isInternal {
				expectedTag = InternalIp
			}

			if resp.SrcIpTag != expectedTag {
				t.Errorf("边界IP %s 期望SrcIpTag=%d, got=%d", tc.ip, expectedTag, resp.SrcIpTag)
			}

			t.Logf("IP %s: SrcIpTag=%d (期望内网=%v)", tc.ip, resp.SrcIpTag, tc.isInternal)
		})
	}
}

// TestSrcIpInfoServer_SrcIpInfoEnrich 服务端方法测试
func TestSrcIpInfoServer_SrcIpInfoEnrich(t *testing.T) {
	server := &SrcIpInfoServer{}
	server.handler = newTestHandlerWithInternalIPs()

	req := &src_ip_info.RequestMsg{SrcIp: "10.0.0.1"}

	ctx := context.Background()
	resp, err := server.SrcIpInfoEnrich(ctx, req)
	if err != nil {
		t.Fatalf("SrcIpInfoEnrich调用失败: %v", err)
	}

	if resp == nil {
		t.Fatal("响应不应为nil")
	}

	t.Logf("服务端方法响应: SrcIpTag=%d, UsergroupId=%d", resp.SrcIpTag, resp.UsergroupId)
}

// TestSrcIpInfoServer_Info 服务信息测试
func TestSrcIpInfoServer_Info(t *testing.T) {
	server := &SrcIpInfoServer{}

	info := server.Info()
	if info == "" {
		t.Fatal("服务信息不应为空")
	}

	t.Logf("服务信息: %s", info)
}
```

---

## Go gRPC测试规范

### 1. 测试文件命名规范
- **文件名**：`{service_name}_test.go`
- **包名**：与被测试代码相同的包
- **位置**：与被测试代码同目录

### 2. 测试函数命名规范
- **服务信息测试**：`Test{ServerType}_Info`
- **Handler方法测试**：`Test{HandlerType}_{MethodName}_{Scenario}`
- **服务端方法测试**：`Test{ServerType}_{ServiceMethod}`

### 3. TestMain模式
用于需要数据库连接的测试：
```go
func TestMain(m *testing.M) {
	// 1. 设置环境变量
	// 2. 初始化插件
	// 3. 运行测试
	// 4. 清理资源
}
```

### 4. 测试数据初始化模式
```go
func newTestHandler(t *testing.T) *HandlerType {
	handler := &HandlerType{}
	// 初始化必要字段
	// 设置默认值（避免依赖数据库配置）
	return handler
}
```

### 5. 子测试模式
```go
for _, tc := range testCases {
	t.Run(tc.name, func(t *testing.T) {
		// 测试逻辑
	})
}
```

### 6. CI/CD环境配置
| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| PG_HOST | postgres | PostgreSQL主机 |
| PG_PORT | 5432 | PostgreSQL端口 |
| PG_USER | admin | 数据库用户 |
| PG_PASSWORD | (空) | 数据库密码 |

