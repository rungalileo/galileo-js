import { calculateDurationNs } from '../../src/utils/utils';

describe('utils', () => {
  describe('calculateDurationNs', () => {
    beforeAll(() => {
      jest.useFakeTimers();
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it('should calculate duration with start and end dates', () => {
      const start = new Date('2023-01-01T00:00:00.000Z');
      const end = new Date('2023-01-01T00:00:01.000Z');
      const duration = calculateDurationNs(start, end);
      expect(duration).toBe(1000 * 1_000_000);
    });

    it('should calculate duration with only start date', () => {
      const start = new Date('2023-01-01T00:00:00.000Z');
      jest.setSystemTime(new Date('2023-01-01T00:00:00.500Z'));

      const duration = calculateDurationNs(start);
      expect(duration).toBe(500 * 1_000_000);
    });
  });
});
