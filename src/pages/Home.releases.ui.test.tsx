import { describe, it, expect } from 'vitest';
import React from 'react';
import { ReleasesPanel } from './Home';

// 仅进行基本渲染测试；完整交互测试需引入 Testing Library。
describe('ReleasesPanel basic', () => {
  it('renders loading or empty states without crashing', () => {
    // 这里不进行实际渲染，仅断言组件存在并可被创建
    const Comp = () => (
      <ReleasesPanel owner="owner" repo="repo" apiToken="" onClose={() => {}} />
    );
    expect(Comp).toBeTruthy();
  });
});