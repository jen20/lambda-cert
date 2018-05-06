package cert

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCertNamesFromConfigVariable(t *testing.T) {
	t.Run("Valid list", func(t *testing.T) {
		const input = "test.jen20.com;    	alsovalid.jen20.com"
		names, err := NamesFromConfigVar(input)
		assert.Nil(t, err)
		assert.Equal(t, 2, len(names))
		assert.Contains(t, names, "test.jen20.com")
		assert.Contains(t, names, "alsovalid.jen20.com")
	})

	t.Run("Wildcard", func(t *testing.T) {
		const input = "*.test.jen20.com"
		names, err := NamesFromConfigVar(input)
		assert.Nil(t, err)
		assert.Equal(t, 1, len(names))
		assert.Contains(t, names, "*.test.jen20.com")
	})

	t.Run("Contains IP address", func(t *testing.T) {
		const input = "10.10.0.10; test.jen20.com"
		names, err := NamesFromConfigVar(input)
		assert.Nil(t, names)
		assert.Error(t, err)
	})

	t.Run("Contains non-valid DNS name", func(t *testing.T) {
		const input = "test.jen20.com/path"
		names, err := NamesFromConfigVar(input)
		assert.Nil(t, names)
		assert.Error(t, err)
	})

	t.Run("Empty input", func(t *testing.T) {
		const input = ""
		names, err := NamesFromConfigVar(input)
		assert.Nil(t, names)
		assert.Error(t, err)
	})
}
