/* eslint-disable @typescript-eslint/no-unused-vars */
import { extractParamsInfo, argsToDict } from '../../src/utils/serialization';

describe('Extract Function Parameters', () => {
  it('should extract parameters and default values', () => {
    const fn = async (a: number, b: string = 'default', c?: boolean) => {};
    const paramsInfo = extractParamsInfo(fn);
    expect(paramsInfo).toEqual([
      { name: 'a', defaultValue: undefined },
      { name: 'b', defaultValue: 'default' },
      { name: 'c', defaultValue: undefined }
    ]);
  });

  it('should handle empty parameters', () => {
    const fn = async () => {};
    const paramsInfo = extractParamsInfo(fn);
    expect(paramsInfo).toEqual([]);
  });

  it('should handle parameters with no default values', () => {
    const fn = async (a: number, b: string, c?: boolean) => {};
    const paramsInfo = extractParamsInfo(fn);
    expect(paramsInfo).toEqual([
      { name: 'a', defaultValue: undefined },
      { name: 'b', defaultValue: undefined },
      { name: 'c', defaultValue: undefined }
    ]);
  });
});

describe('Convert Arguments to Dictionary', () => {
  it('should convert arguments to dictionary', () => {
    const fn = async (a: number, b: string = 'default', c?: boolean) => {};
    const paramsInfo = extractParamsInfo(fn);
    const args = [1, 'test'];
    const dict = argsToDict(paramsInfo, args);
    expect(dict).toEqual({
      a: 1,
      b: 'test',
      c: undefined
    });
  });

  it('should handle empty arguments', () => {
    const fn = async (a: number, b: string = 'default', c?: boolean) => {};
    const paramsInfo = extractParamsInfo(fn);
    const args: unknown[] = [];
    const dict = argsToDict(paramsInfo, args);
    expect(dict).toEqual({
      a: undefined,
      b: 'default',
      c: undefined
    });
  });
});
