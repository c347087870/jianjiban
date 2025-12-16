<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup>
defineOptions({
  name: 'App'
});
</script>

<style>
#app {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}
::-webkit-scrollbar {
		display: none;
	}
</style>
