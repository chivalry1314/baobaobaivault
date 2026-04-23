package webpush

import webpush "github.com/SherClockHolmes/webpush-go"

func GenerateVAPIDKeys() (publicKey, privateKey string, err error) {
	return webpush.GenerateVAPIDKeys()
}
