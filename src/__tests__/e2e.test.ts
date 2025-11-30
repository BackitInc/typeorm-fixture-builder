/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataSource } from 'typeorm';
import { collect } from '../collect';
import { fixture } from '../fixture';
import { install } from '../install';
import { clear } from '../persist';
import { Group } from './entities/group';
import { Picture } from './entities/picture';
import { Profile } from './entities/profile';
import { User } from './entities/user';
import * as simpleBundle from './scenarios/simple/simple.bundle';
import * as complexBundle from './scenarios/complex/complex.bundle';
import * as importsBundle from './scenarios/imports/imports.bundle';

let source: DataSource;

beforeEach(async () => {
  source = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [Group, User, Profile, Picture],
    dropSchema: true,
    synchronize: true,
  });

  await source.initialize();
});

afterEach(async () => {
  await source.destroy();

  clear();
});

describe('install', () => {
  it.each([
    ['simple', simpleBundle],
    ['complex', complexBundle],
    ['imports', importsBundle],
  ])('should successfully complete scenario %s', async (name, bundle) => {
    const fixtures = collect(bundle) as any[];
    const fixturesByType = fixtures.reduce<{ [key: string]: any[] }>(
      (grouped, fixture) => ({
        ...grouped,
        [fixture.constructor.name]: [
          ...(grouped[fixture.constructor.name] || []),
          fixture,
        ],
      }),
      {},
    );

    await install(source, fixtures);

    for (const [group, fixtures] of Object.entries(fixturesByType)) {
      for (const fixture of fixtures) {
        expect(fixture.id).toBeDefined();
      }

      expect(await source.getRepository(group).count()).toEqual(
        fixtures.length,
      );
    }
  });

  it('should accept an install callback', async () => {
    const fixtures = collect(simpleBundle) as any[];

    const callback = jest.fn();

    await install(source, fixtures, callback);

    expect(callback).toHaveBeenCalledTimes(fixtures.length);
  });

  it('should allow to reset persistence cache', async () => {
    const fixtures = collect(complexBundle) as any[];

    await install(source, fixtures, (_, skipped) => {
      expect(skipped).toEqual(false);
    });

    await install(source, fixtures, (_, skipped) => {
      expect(skipped).toEqual(true);
    });

    clear();

    await install(source, fixtures, (_, skipped) => {
      expect(skipped).toEqual(false);
    });
  });

  describe('resolve', () => {
    it('should use and merge resolved entity', async () => {
      const resolver = jest.fn((repository, { firstName }) =>
        repository
          .createQueryBuilder('user')
          .where('user.firstName = :firstName', { firstName }),
      );

      const user1 = fixture(
        User,
        { firstName: 'Foo', lastName: 'Bar' },
        resolver,
      );

      const user2 = fixture(
        User,
        { firstName: 'Foo', lastName: 'Baz' },
        resolver,
      );

      await install(source, [user1, user2]);

      expect(resolver).toHaveBeenCalledTimes(2);
      expect(await source.getRepository(User).count()).toEqual(1);
      expect(
        await source
          .getRepository(User)
          .findOne({ where: { firstName: 'Foo' } }),
      ).toEqual({
        id: 1,
        firstName: 'Foo',
        lastName: 'Baz',
      });
    });

    it('should use fixture when no entity is resolved', async () => {
      const resolver = jest.fn(repository =>
        repository
          .createQueryBuilder('user')
          .where('user.firstName = :firstName', { firstName: 'Baz' }),
      );

      const user1 = fixture(
        User,
        { firstName: 'Foo', lastName: 'Bar' },
        resolver,
      );

      const user2 = fixture(
        User,
        { firstName: 'Foo', lastName: 'Baz' },
        resolver,
      );

      await install(source, [user1, user2]);

      expect(resolver).toHaveBeenCalledTimes(2);
      expect(await source.getRepository(User).count()).toEqual(2);
      expect(await source.getRepository(User).find()).toEqual([
        {
          id: 1,
          firstName: 'Foo',
          lastName: 'Bar',
        },
        {
          id: 2,
          firstName: 'Foo',
          lastName: 'Baz',
        },
      ]);
    });
  });
});
