# Design

- owner: mvp-task-artifact-loop
- state: active

## Flow

`createDemoTaskArtifactLoop(input)` -> core projection -> `MockOplAdapter.run(["opl","contract","domains"])` -> completed task + artifact projection。

## Boundary

- API 返回中文 demo projection。
- OPL Adapter 只走已允许的 readonly command。
- artifact 必须包含 `sourceRefs`，保留追踪下限。
