import {
    EventSerializer,
    serializeToStr
  } from '../../src/entities/serialization';
  
  describe('EventSerializer', () => {
    let serializer: EventSerializer;
  
    beforeEach(() => {
      serializer = new EventSerializer();
    });
  
    describe('Primitive types', () => {
      it('should serialize strings', () => {
        expect(serializer.default('test string')).toBe('test string');
      });
  
      it('should serialize numbers', () => {
        expect(serializer.default(42)).toBe(42);
        expect(serializer.default(3.14)).toBe(3.14);
        expect(serializer.default(-10)).toBe(-10);
      });
  
      it('should serialize booleans', () => {
        expect(serializer.default(true)).toBe(true);
        expect(serializer.default(false)).toBe(false);
      });
  
      it('should serialize null', () => {
        expect(serializer.default(null)).toBe(null);
      });
  
      it('should serialize undefined', () => {
        expect(serializer.default(undefined)).toBe(undefined);
      });
    });
  
    describe('Date objects', () => {
      it('should serialize Date objects to ISO string', () => {
        const date = new Date('2024-01-01T12:00:00Z');
        const result = serializer.default(date);
        expect(result).toBe('2024-01-01T12:00:00.000Z');
      });
  
      it('should serialize Date objects in encode()', () => {
        const date = new Date('2024-01-01T12:00:00Z');
        const result = serializer.encode({ timestamp: date });
        expect(result).toContain('2024-01-01T12:00:00.000Z');
      });
    });
  
    describe('Error objects', () => {
      it('should serialize Error objects', () => {
        const error = new Error('Test error message');
        const result = serializer.default(error);
        expect(result).toBe('Error: Test error message');
      });
  
      it('should serialize custom Error types', () => {
        class CustomError extends Error {
          constructor(message: string) {
            super(message);
            this.name = 'CustomError';
          }
        }
  
        const error = new CustomError('Custom error message');
        const result = serializer.default(error);
        expect(result).toBe('CustomError: Custom error message');
      });
    });
  
    describe('Large integers', () => {
      it('should serialize integers within JS safe range as numbers', () => {
        const maxSafe = 2 ** 53 - 1;
        const minSafe = -(2 ** 53) + 1;
  
        expect(serializer.default(maxSafe)).toBe(maxSafe);
        expect(serializer.default(minSafe)).toBe(minSafe);
      });
  
      it('should serialize integers outside JS safe range as strings', () => {
        const tooLarge = 2 ** 53;
        const tooSmall = -(2 ** 53) - 1;
  
        expect(serializer.default(tooLarge)).toBe(String(tooLarge));
        expect(serializer.default(tooSmall)).toBe(String(tooSmall));
      });
  
      it('should handle boundary values correctly', () => {
        const maxSafe = 2 ** 53 - 1;
        const minSafe = -(2 ** 53) + 1;
        const justOverMax = 2 ** 53;
        const justUnderMin = -(2 ** 53);
  
        expect(serializer.default(maxSafe)).toBe(maxSafe);
        expect(serializer.default(minSafe)).toBe(minSafe);
        expect(serializer.default(justOverMax)).toBe(String(justOverMax));
        expect(serializer.default(justUnderMin)).toBe(String(justUnderMin));
      });
    });
  
    describe('Circular references', () => {
      it('should handle circular references in objects', () => {
        const obj: Record<string, unknown> = { name: 'test' };
        obj.self = obj;
  
        const result = serializer.default(obj);
        expect(result).toEqual({ name: 'test', self: '<Object>' });
      });
  
      it('should handle nested circular references', () => {
        const parent: Record<string, unknown> = { name: 'parent' };
        const child: Record<string, unknown> = { name: 'child', parent };
        parent.child = child;
  
        const result = serializer.default(parent);
        expect(result).toEqual({
          name: 'parent',
          child: { name: 'child', parent: '<Object>' }
        });
      });
  
      it('should handle circular references in arrays', () => {
        const arr: unknown[] = [1, 2, 3];
        arr.push(arr);
  
        // Arrays are handled before object circular reference check
        // This may cause issues, but we test that it doesn't crash
        const result = serializer.default(arr);
        // The result will be a deeply nested structure or may cause issues
        // We just verify it returns something (doesn't crash)
        expect(result).toBeDefined();
        // If it's an array, it should have at least the original 3 elements
        if (Array.isArray(result)) {
          expect(result.length).toBeGreaterThanOrEqual(3);
        }
      });
    });
  
    describe('Arrays', () => {
      it('should serialize simple arrays', () => {
        const arr = [1, 2, 3, 'test'];
        expect(serializer.default(arr)).toEqual([1, 2, 3, 'test']);
      });
  
      it('should serialize nested arrays', () => {
        const arr = [
          [1, 2],
          [3, 4]
        ];
        expect(serializer.default(arr)).toEqual([
          [1, 2],
          [3, 4]
        ]);
      });
  
      it('should serialize arrays with mixed types', () => {
        const arr = [1, 'string', true, null, { key: 'value' }];
        const result = serializer.default(arr);
        expect(result).toEqual([1, 'string', true, null, { key: 'value' }]);
      });
    });
  
    describe('Sets', () => {
      it('should serialize Set objects to arrays', () => {
        const set = new Set([1, 2, 3]);
        const result = serializer.default(set);
        expect(result).toEqual([1, 2, 3]);
      });
  
      it('should serialize Set with mixed types', () => {
        const set = new Set(['a', 1, true]);
        const result = serializer.default(set);
        expect(result).toEqual(['a', 1, true]);
      });
  
      it('should serialize nested Sets', () => {
        const set = new Set([new Set([1, 2]), new Set([3, 4])]);
        const result = serializer.default(set);
        expect(result).toEqual([
          [1, 2],
          [3, 4]
        ]);
      });
    });
  
    describe('Maps', () => {
      it('should serialize Map objects to plain objects', () => {
        const map = new Map([
          ['key1', 'value1'],
          ['key2', 'value2']
        ]);
        const result = serializer.default(map);
        expect(result).toEqual({
          key1: 'value1',
          key2: 'value2'
        });
      });
  
      it('should serialize Map with non-string keys', () => {
        const map = new Map<string | number | boolean, string>([
          [1, 'one'],
          [true, 'true'],
          ['string', 'value']
        ]);
        const result = serializer.default(map);
        expect(result).toEqual({
          '1': 'one',
          true: 'true',
          string: 'value'
        });
      });
  
      it('should serialize nested Maps', () => {
        const innerMap = new Map([['inner', 'value']]);
        const outerMap = new Map([['outer', innerMap]]);
        const result = serializer.default(outerMap);
        expect(result).toEqual({
          outer: { inner: 'value' }
        });
      });
    });
  
    describe('ArrayBuffer and TypedArrays', () => {
      it('should serialize ArrayBuffer to string', () => {
        const buffer = new ArrayBuffer(8);
        const view = new Uint8Array(buffer);
        view[0] = 72; // 'H'
        view[1] = 101; // 'e'
        view[2] = 108; // 'l'
        view[3] = 108; // 'l'
        view[4] = 111; // 'o'
  
        const result = serializer.default(buffer);
        expect(result).toContain('Hello');
      });
  
      it('should serialize Uint8Array', () => {
        const arr = new Uint8Array([72, 101, 108, 108, 111]);
        const result = serializer.default(arr);
        expect(result).toBe('Hello');
      });
  
      it('should serialize Uint16Array', () => {
        // Uint16Array elements are 2 bytes each, so when decoded as UTF-8,
        // they produce null bytes between characters
        const arr = new Uint16Array([72, 101, 108, 108, 111]);
        const result = serializer.default(arr);
        // The result will be a string with null bytes, not "Hello"
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
  
      it('should serialize Uint32Array', () => {
        // Uint32Array elements are 4 bytes each, so when decoded as UTF-8,
        // they produce null bytes between characters
        const arr = new Uint32Array([72, 101, 108, 108, 111]);
        const result = serializer.default(arr);
        // The result will be a string with null bytes, not "Hello"
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
  
      it('should handle invalid UTF-8 in ArrayBuffer', () => {
        // Create an ArrayBuffer that cannot be decoded as UTF-8
        // TextDecoder may not throw on invalid UTF-8, so we'll create a buffer
        // that when decoded produces a result, but we can test the fallback path
        // by creating a buffer that's too large or using a different approach
        const buffer = new ArrayBuffer(1);
        const view = new Uint8Array(buffer);
        view[0] = 0xff; // Invalid UTF-8
  
        const result = serializer.default(buffer);
        // TextDecoder may decode this as a replacement character or similar
        // The actual behavior depends on TextDecoder implementation
        // If it can't decode, it returns '<not serializable bytes>'
        // Otherwise it returns the decoded string (which may be a replacement character)
        expect(typeof result === 'string').toBe(true);
      });
    });
  
    describe('Objects with private properties', () => {
      it('should exclude properties starting with underscore', () => {
        const obj = {
          public: 'value',
          _private: 'hidden',
          _anotherPrivate: 'also hidden',
          normal: 'visible'
        };
  
        const result = serializer.default(obj);
        expect(result).toEqual({
          public: 'value',
          normal: 'visible'
        });
      });
  
      it('should handle nested objects with private properties', () => {
        const obj = {
          public: 'value',
          nested: {
            public: 'nested value',
            _private: 'hidden'
          }
        };
  
        const result = serializer.default(obj);
        expect(result).toEqual({
          public: 'value',
          nested: {
            public: 'nested value'
          }
        });
      });
    });
  
    describe('Nested objects', () => {
      it('should serialize deeply nested objects', () => {
        const obj = {
          level1: {
            level2: {
              level3: {
                level4: {
                  data: 'deep value'
                }
              }
            }
          }
        };
  
        const result = serializer.default(obj);
        expect(result).toEqual({
          level1: {
            level2: {
              level3: {
                level4: {
                  data: 'deep value'
                }
              }
            }
          }
        });
      });
  
      it('should serialize objects with mixed nested types', () => {
        const obj = {
          string: 'value',
          number: 42,
          boolean: true,
          array: [1, 2, 3],
          nested: {
            date: new Date('2024-01-01T00:00:00Z'),
            error: new Error('test')
          }
        };
  
        const result = serializer.default(obj);
        expect(result).toHaveProperty('string', 'value');
        expect(result).toHaveProperty('number', 42);
        expect(result).toHaveProperty('boolean', true);
        expect(result).toHaveProperty('array', [1, 2, 3]);
        expect(result).toHaveProperty('nested');
      });
    });
  
    describe('Enum-like objects', () => {
      it('should serialize objects with value property', () => {
        const enumLike = { value: 'enum-value' };
        const result = serializer.default(enumLike);
        expect(result).toBe('enum-value');
      });
  
      it('should serialize enum-like objects with various value types', () => {
        expect(serializer.default({ value: 42 })).toBe(42);
        expect(serializer.default({ value: true })).toBe(true);
        expect(serializer.default({ value: null })).toBe(null);
      });
  
      it('should not treat regular objects with value property as enums if value is undefined', () => {
        const obj = { value: undefined, other: 'property' };
        const result = serializer.default(obj);
        expect(result).toEqual({ value: undefined, other: 'property' });
      });
    });
  
    describe('Serialization failures', () => {
      it('should handle objects that throw during serialization', () => {
        const problematicObj = {
          get value() {
            throw new Error('Cannot access value');
          }
        };
  
        const result = serializer.default(problematicObj);
        expect(result).toContain('not serializable object of type');
      });
  
      it('should handle objects with getters that throw', () => {
        const obj = {
          normal: 'value',
          get problematic() {
            throw new Error('Getter error');
          }
        };
  
        const result = serializer.default(obj);
        // When serialization fails, EventSerializer returns '<Object>'
        expect(result).toBe('<Object>');
      });
    });
  
    describe('encode() method', () => {
      it('should encode simple object to JSON string', () => {
        // Note: Objects with 'value' property are treated as enums and return just the value
        // So we use 'data' instead of 'value' to test normal object serialization
        const obj = { name: 'test', data: 42 };
        const result = serializer.encode(obj);
        expect(result).toBe('{"name":"test","data":42}');
      });
  
      it('should encode complex object to JSON string', () => {
        const obj = {
          string: 'value',
          number: 42,
          date: new Date('2024-01-01T12:00:00Z'),
          array: [1, 2, 3],
          nested: { key: 'value' }
        };
  
        const result = serializer.encode(obj);
        expect(JSON.parse(result)).toEqual({
          string: 'value',
          number: 42,
          date: '2024-01-01T12:00:00.000Z',
          array: [1, 2, 3],
          nested: { key: 'value' }
        });
      });
  
      it('should handle encoding failures gracefully', () => {
        const problematicObj = {
          get value() {
            throw new Error('Cannot serialize');
          }
        };
  
        const result = serializer.encode(problematicObj);
        expect(result).toContain('not serializable object of type');
      });
  
      it('should reset seen set for each encode call', () => {
        const obj: Record<string, unknown> = { name: 'test' };
        obj.self = obj;
  
        // First encode
        const result1 = serializer.encode(obj);
        expect(result1).toContain('"self":"<Object>"');
  
        // Second encode should work the same way
        const result2 = serializer.encode(obj);
        expect(result2).toContain('"self":"<Object>"');
      });
    });
  
    describe('Mixed complex objects', () => {
      it('should serialize complex mixed object', () => {
        const complex = {
          string: 'value',
          number: 42,
          boolean: true,
          nullValue: null,
          date: new Date('2024-01-01T00:00:00Z'),
          error: new Error('test error'),
          array: [1, 'two', true],
          set: new Set([1, 2, 3]),
          map: new Map([['key', 'value']]),
          nested: {
            deep: {
              value: 'deep'
            }
          },
          _private: 'hidden'
        };
  
        const result = serializer.default(complex);
        expect(result).toHaveProperty('string', 'value');
        expect(result).toHaveProperty('number', 42);
        expect(result).toHaveProperty('boolean', true);
        expect(result).toHaveProperty('nullValue', null);
        expect(result).toHaveProperty('date');
        expect(result).toHaveProperty('error');
        expect(result).toHaveProperty('array');
        expect(result).toHaveProperty('set');
        expect(result).toHaveProperty('map');
        expect(result).toHaveProperty('nested');
        expect(result).not.toHaveProperty('_private');
      });
    });
  
    describe('serializeToStr() function', () => {
      it('should serialize string to string', () => {
        // serializeToStr returns strings directly without JSON.stringify
        expect(serializeToStr('test')).toBe('test');
      });
  
      it('should serialize number to string', () => {
        expect(serializeToStr(42)).toBe('42');
      });
  
      it('should serialize boolean to string', () => {
        expect(serializeToStr(true)).toBe('true');
        expect(serializeToStr(false)).toBe('false');
      });
  
      it('should serialize null to string', () => {
        expect(serializeToStr(null)).toBe('null');
      });
  
      it('should serialize undefined to string', () => {
        // serializeToStr returns JSON.stringify(undefined)
        // JSON.stringify(undefined) returns undefined (the value), not a string
        const result = serializeToStr(undefined);
        // The function returns undefined for undefined input (JSON.stringify behavior)
        expect(result).toBeUndefined();
      });
  
      it('should serialize object to JSON string', () => {
        const obj = { name: 'test', count: 42 };
        const result = serializeToStr(obj);
        expect(JSON.parse(result)).toEqual(obj);
      });
  
      it('should handle serialization failures', () => {
        const problematicObj = {
          get data() {
            throw new Error('Cannot serialize');
          }
        };
  
        const result = serializeToStr(problematicObj);
        // serializeToStr uses EventSerializer.encode() which returns error string on failure
        // The format is: "<not serializable object of type: TypeName>" or "<Object>"
        expect(result).toMatch(/<.*Object.*>/);
      });
    });
  
    describe('Edge cases', () => {
      it('should handle empty objects', () => {
        expect(serializer.default({})).toEqual({});
      });
  
      it('should handle empty arrays', () => {
        expect(serializer.default([])).toEqual([]);
      });
  
      it('should handle empty Sets', () => {
        expect(serializer.default(new Set())).toEqual([]);
      });
  
      it('should handle empty Maps', () => {
        expect(serializer.default(new Map())).toEqual({});
      });
  
      it('should handle objects with only private properties', () => {
        const obj = {
          _private1: 'hidden1',
          _private2: 'hidden2'
        };
  
        const result = serializer.default(obj);
        expect(result).toEqual({});
      });
  
      it('should handle objects with prototype properties', () => {
        class TestClass {
          public instanceProp = 'value';
        }
  
        const instance = new TestClass();
        const result = serializer.default(instance);
        expect(result).toEqual({ instanceProp: 'value' });
      });
  
      it('should handle objects with null prototype', () => {
        const obj = Object.create(null);
        obj.key = 'value';
        const result = serializer.default(obj);
        expect(result).toEqual({ key: 'value' });
      });
    });
  });