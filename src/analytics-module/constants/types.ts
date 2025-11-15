export enum EAnalyticsEventType {
  BOT_START = 'bot_start',
  BUTTON_CLICK = 'button_click',
  ACTION_PERFORMED = 'action_performed',
  ERROR = 'error',
}

export enum EAnalyticsEventName {
  // Bot start
  START_COMMAND = 'start_command',
  
  // Button clicks
  MENU_BUTTON = 'menu_button',
  PAYMENT_BUTTON = 'payment_button',
  PHOTO_SCENE_BUTTON = 'photo_scene_button',
  BACK_TO_MENU = 'back_to_menu',
  TARIFF_SELECT = 'tariff_select',
  
  // Actions
  PHOTO_UPLOADED = 'photo_uploaded',
  PHOTO_PROCESSED = 'photo_processed',
  PAYMENT_INITIATED = 'payment_initiated',
  PAYMENT_SUCCESS = 'payment_success',
  PAYMENT_FAILED = 'payment_failed',
  SCENE_ENTERED = 'scene_entered',
  SCENE_LEFT = 'scene_left',
  
  // Errors
  PROCESSING_ERROR = 'processing_error',
  PAYMENT_ERROR = 'payment_error',
  FILE_ERROR = 'file_error',
  REPLICATE_ERROR = 'replicate_error',
  QUEUE_ERROR = 'queue_error',
}

