/**
 * GitHub repository management utilities
 */
import { Octokit } from '@octokit/rest';

export interface CreateRepoOptions {
  name: string;
  description?: string;
  private: boolean;
  autoInit: boolean; // Initialize with README
}

export interface CreateRepoResult {
  fullName: string; // owner/repo
  htmlUrl: string; // https://github.com/owner/repo
  cloneUrl: string; // https://github.com/owner/repo.git
  defaultBranch: string; // main
}

/**
 * Create a new GitHub repository for authenticated user
 */
export async function createRepository(
  token: string,
  options: CreateRepoOptions
): Promise<CreateRepoResult> {
  const octokit = new Octokit({ auth: token });

  try {
    const { data } = await octokit.rest.repos.createForAuthenticatedUser({
      name: options.name,
      description: options.description,
      private: options.private,
      auto_init: options.autoInit,
    });

    return {
      fullName: data.full_name,
      htmlUrl: data.html_url,
      cloneUrl: data.clone_url,
      defaultBranch: data.default_branch,
    };
  } catch (error) {
    const err = error as Error;
    throw new Error(`Failed to create GitHub repository: ${err.message}`);
  }
}
