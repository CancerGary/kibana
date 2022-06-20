/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { uniq, map } from 'lodash';
import type { SavedObjectsClientContract } from '@kbn/core/server';

import type {
  PackagePolicyServiceInterface,
  AgentPolicyServiceInterface,
  AgentService,
} from '@kbn/fleet-plugin/server';
import type {
  GetAgentPoliciesResponseItem,
  PackagePolicy,
  AgentPolicy,
  ListResult,
} from '@kbn/fleet-plugin/common';

import {
  BENCHMARK_PACKAGE_POLICY_PREFIX,
  BenchmarksQuerySchema,
} from '../../common/schemas/benchmark';

export const PACKAGE_POLICY_SAVED_OBJECT_TYPE = 'ingest-package-policies';

const getPackageNameQuery = (packageName: string, benchmarkFilter?: string): string => {
  const integrationNameQuery = `${PACKAGE_POLICY_SAVED_OBJECT_TYPE}.package.name:${packageName}`;
  const kquery = benchmarkFilter
    ? `${integrationNameQuery} AND ${PACKAGE_POLICY_SAVED_OBJECT_TYPE}.name: *${benchmarkFilter}*`
    : integrationNameQuery;

  return kquery;
};

export const addRunningAgentToAgentPolicy = async (
  agentService: AgentService,
  agentPolicies: AgentPolicy[]
): Promise<GetAgentPoliciesResponseItem[]> => {
  if (!agentPolicies?.length) return [];
  return Promise.all(
    agentPolicies.map((agentPolicy) =>
      agentService.asInternalUser
        .getAgentStatusForAgentPolicy(agentPolicy.id)
        .then((agentStatus) => ({
          ...agentPolicy,
          agents: agentStatus.total,
        }))
    )
  );
};

export const getCspAgentPolicies = async (
  soClient: SavedObjectsClientContract,
  packagePolicies: PackagePolicy[],
  agentPolicyService: AgentPolicyServiceInterface
): Promise<AgentPolicy[]> => {
  const agentPolicyIds = uniq(map(packagePolicies, 'policy_id'));
  const agentPolicies = await agentPolicyService.getByIds(soClient, agentPolicyIds);

  return agentPolicies;
};

export const getCspPackagePolicies = (
  soClient: SavedObjectsClientContract,
  packagePolicyService: PackagePolicyServiceInterface,
  packageName: string,
  queryParams: Partial<BenchmarksQuerySchema>
): Promise<ListResult<PackagePolicy>> => {
  if (!packagePolicyService) {
    throw new Error('packagePolicyService is undefined');
  }

  const sortField = queryParams.sort_field?.startsWith(BENCHMARK_PACKAGE_POLICY_PREFIX)
    ? queryParams.sort_field.substring(BENCHMARK_PACKAGE_POLICY_PREFIX.length)
    : queryParams.sort_field;

  return packagePolicyService?.list(soClient, {
    kuery: getPackageNameQuery(packageName, queryParams.benchmark_name),
    page: queryParams.page,
    perPage: queryParams.per_page,
    sortField,
    sortOrder: queryParams.sort_order,
  });
};
