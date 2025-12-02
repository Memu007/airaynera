describe('Test simple anti-loop', () => {
    test('suma básica', () => {
        expect(1 + 1).toBe(2);
    });

    test('objeto simple', () => {
        const obj = { name: 'test' };
        expect(obj.name).toBe('test');
    });
});
