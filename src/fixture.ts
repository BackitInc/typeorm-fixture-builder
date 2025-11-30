import { DeepPartial } from 'typeorm';
import { setResolver } from './reflect';
import { Resolver } from './resolve';

/**
 * Fixture data type that allows fixtures (class instances) in place of relation entities.
 * This extends DeepPartial to support nested fixtures as relations.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FixtureData<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<U | FixtureData<U>>
    : T[P] extends object | null | undefined
      ? T[P] | FixtureData<T[P]>
      : T[P];
};

/**
 * Defines a fixture.
 *
 * @param entity Entity.
 * @param data Data for entity.
 * @param resolver Custom entity resolver.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fixture<Entity extends new () => any>(
  entity: Entity,
  data: FixtureData<InstanceType<Entity>> | DeepPartial<InstanceType<Entity>>,
  resolver?: Resolver<Entity>,
): InstanceType<Entity> {
  const instance = new entity();

  setResolver(instance, resolver);

  return Object.assign(instance, data);
}
