<?php

namespace App\Enums;

enum NotifChannel: string
{
    case Email = 'email';
    case Webhook = 'webhook';
}
