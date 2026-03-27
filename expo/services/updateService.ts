import * as Updates from 'expo-updates';

export type OtaUpdateStatus =
  | 'disabled'
  | 'up-to-date'
  | 'update-applied'
  | 'error';

export interface OtaUpdateResult {
  status: OtaUpdateStatus;
  message?: string;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Impossible de verifier les mises a jour pour le moment.';
}

export async function checkAndApplyOtaUpdate(): Promise<OtaUpdateResult> {
  if (__DEV__ || !Updates.isEnabled) {
    return {
      status: 'disabled',
      message: 'Les mises a jour OTA ne sont pas actives dans cet environnement.',
    };
  }

  try {
    const update = await Updates.checkForUpdateAsync();

    if (!update.isAvailable) {
      return {
        status: 'up-to-date',
        message: 'Cette version est deja a jour.',
      };
    }

    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();

    return {
      status: 'update-applied',
      message: 'La mise a jour a ete appliquee.',
    };
  } catch (error) {
    return {
      status: 'error',
      message: getErrorMessage(error),
    };
  }
}