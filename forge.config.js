module.exports = {
	packagerConfig: {
		// set config executableName
		executableName: "wlgate",
		icon: './favicon.ico',
		asar: true,
	},
	publishers: [
		{
			name: '@electron-forge/publisher-github',
			config: {
				repository: {
					owner: 'int2001',
					name: 'wsjtx2cl'
				},
				prerelease: true
			}
		}
	],
	rebuildConfig: {},
	makers: [
		{
			name: '@electron-forge/maker-squirrel',
			config: { icon: "./favicon.ico", maintainer: 'DJ7NT', loadingGif: "loading.gif", name: "SW2CL_DJ7NT" },
		},
		{
			name: '@electron-forge/maker-dmg',
			config: { format: 'ULFO' },
			platforms: ['darwin'],
		},
		{
			name: '@electron-forge/maker-deb',
			config: { "bin":"wlgate" },
			arch: ['x86']
		},
	],
	plugins: [
		{
			name: '@electron-forge/plugin-auto-unpack-natives',
			config: {},
		},
	],
};
